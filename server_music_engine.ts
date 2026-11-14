import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import { callGroqChat } from './server_groq_service.ts';
import { getActiveLocalEndpointConfig, callLocalLlmChat } from './server_local_llm.ts';
import { SYSTEM_PROMPT, appendRuntimeMetadata } from './src/lib/systemPrompts.ts';
import type { ByokKeyMap } from './server_tenant_store.ts';
import {
  DEFAULT_MUSIC_CONFIG,
  type MusicConfig,
  type MusicDspSettings,
  type MusicEnhanceBreakdown,
  type MusicEnhancerMode,
  type MusicOperationType,
} from './src/types/music.ts';
import type { GeneratedAudioItem } from './src/types/index.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.join(__dirname, 'data', 'tenants');

export interface AudioProbeInfo {
  duration: number;
  sampleRate: number;
  channels: number;
  bitrateKbps: number;
  codec: string;
  fileSizeBytes: number;
}

export interface MusicPublishedSnapshot {
  shareId: string;
  tenantId: string;
  trackId: string;
  title: string;
  prompt: string;
  lyrics: string;
  styleTags: string[];
  model: string;
  bpm: number;
  keySignature: string;
  duration: number;
  audioFilename: string;
  coverFilename: string;
  publishedAt: string;
}

function safeSegment(value: string): string {
  return String(value || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 96);
}

export function getTenantMusicAssetDir(tenantId: string): string {
  const dir = path.join(DATA_ROOT, safeSegment(tenantId), 'audio_assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveTenantMusicAssetPath(tenantId: string, filename: string): string | null {
  const clean = path.basename(String(filename || '').trim());
  if (!clean || clean === '.' || clean === '..' || !/^[a-zA-Z0-9._-]+$/.test(clean)) {
    return null;
  }
  const dir = getTenantMusicAssetDir(tenantId);
  const resolved = path.resolve(dir, clean);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    return null;
  }
  return resolved;
}

export async function saveTenantMusicAssetBuffer(
  tenantId: string,
  baseId: string,
  ext: 'mp3' | 'wav' | 'flac' | 'jpg' | 'png' | 'svg',
  buffer: Buffer
): Promise<{ filename: string; filePath: string; url: string }> {
  const dir = getTenantMusicAssetDir(tenantId);
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 8);
  const filename = `${safeSegment(baseId)}_${hash}.${ext}`;
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return {
    filename,
    filePath,
    url: `/api/audio/assets/${encodeURIComponent(filename)}`,
  };
}

export async function deleteTenantMusicAssets(
  tenantId: string,
  filenames: Array<string | undefined | null>
): Promise<void> {
  for (const name of filenames) {
    if (!name) continue;
    const p = resolveTenantMusicAssetPath(tenantId, name);
    if (p && fs.existsSync(p)) {
      await fs.promises.unlink(p).catch(() => {});
    }
  }
}

export function streamMusicAssetWithRange(req: Request, res: Response, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp3'
      ? 'audio/mpeg'
      : ext === '.wav'
      ? 'audio/wav'
      : ext === '.flac'
      ? 'audio/flac'
      : ext === '.m4a'
      ? 'audio/mp4'
      : ext === '.ogg'
      ? 'audio/ogg'
      : ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
      ? 'image/png'
      : ext === '.svg'
      ? 'image/svg+xml'
      : 'application/octet-stream';

  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

  if (range && contentType.startsWith('audio/')) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Math.min(Number(match[1]), Math.max(0, totalSize - 1));
      const requestedEnd = match[2] ? Number(match[2]) : totalSize - 1;
      const end = Math.min(requestedEnd, Math.max(0, totalSize - 1));
      if (start <= end && totalSize > 0) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }

  res.setHeader('Content-Length', String(totalSize));
  fs.createReadStream(filePath).pipe(res);
}

export async function probeAudioFile(filePath: string): Promise<AudioProbeInfo> {
  const stat = await fs.promises.stat(filePath);
  const fallback: AudioProbeInfo = {
    duration: 30,
    sampleRate: 44100,
    channels: 2,
    bitrateKbps: 192,
    codec: 'mp3',
    fileSizeBytes: stat.size,
  };

  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { timeout: 15000 }
    );
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const audioStream = streams.find((s: any) => s.codec_type === 'audio');
    const dur = Number(parsed?.format?.duration || audioStream?.duration || 30);
    const bitRate = Number(parsed?.format?.bit_rate || audioStream?.bit_rate || 192000);

    return {
      duration: Number.isFinite(dur) && dur > 0 ? Number(dur.toFixed(2)) : 30,
      sampleRate: Number(audioStream?.sample_rate) || 44100,
      channels: Number(audioStream?.channels) || 2,
      bitrateKbps: Math.max(64, Math.round(bitRate / 1000)),
      codec: String(audioStream?.codec_name || 'mp3'),
      fileSizeBytes: stat.size,
    };
  } catch {
    return fallback;
  }
}

export async function transcodeNormalizeAudio(
  inputPath: string,
  outPath: string,
  format: 'mp3' | 'wav' = 'mp3',
  normalizeLoudness = true
): Promise<void> {
  const af = normalizeLoudness ? 'loudnorm=I=-14:TP=-1.5:LRA=11' : 'anull';
  if (format === 'wav') {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', inputPath, '-vn', '-af', af, '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', outPath],
      { timeout: 60000 }
    );
  } else {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-i', inputPath, '-vn', '-af', af, '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '256k', outPath],
      { timeout: 60000 }
    );
  }
}

export async function trimAudioFfmpeg(
  inputPath: string,
  outPath: string,
  startSec: number,
  endSec: number,
  format: 'mp3' | 'wav' = 'mp3'
): Promise<void> {
  const safeStart = Math.max(0, Number(startSec) || 0);
  const dur = Math.max(0.5, (Number(endSec) || safeStart + 5) - safeStart);
  const fadeOutStart = Math.max(0, dur - 0.15);
  const af = `afade=t=in:st=0:d=0.06,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.15`;

  const codecArgs =
    format === 'wav'
      ? ['-c:a', 'pcm_s16le']
      : ['-c:a', 'libmp3lame', '-b:a', '256k'];

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      safeStart.toFixed(2),
      '-i',
      inputPath,
      '-t',
      dur.toFixed(2),
      '-vn',
      '-af',
      af,
      '-ar',
      '44100',
      '-ac',
      '2',
      ...codecArgs,
      outPath,
    ],
    { timeout: 60000 }
  );
}

function buildAtempoChain(targetFactor: number): string[] {
  const clamped = Math.min(2.0, Math.max(0.5, targetFactor || 1.0));
  if (Math.abs(clamped - 1.0) < 0.01) return [];
  return [`atempo=${clamped.toFixed(3)}`];
}

export async function dspTransformAudioFfmpeg(
  inputPath: string,
  outPath: string,
  dsp: Partial<MusicDspSettings>,
  opts?: { format?: 'mp3' | 'wav'; removeVocals?: boolean; totalDurationSec?: number }
): Promise<void> {
  const filters: string[] = [];

  if (opts?.removeVocals) {
    // Mid-side center removal for Karaoke / Instrumental isolation
    filters.push('pan=stereo|c0=c0-c1|c1=c1-c0');
  }

  const pitch = Number(dsp.pitchSemitones) || 0;
  const tempo = Number(dsp.tempoMultiplier) || 1.0;

  if (Math.abs(pitch) >= 0.25) {
    const pitchRatio = Math.pow(2, pitch / 12);
    filters.push(`asetrate=44100*${pitchRatio.toFixed(5)}`, 'aresample=44100');
    const compensatingTempo = Math.min(2.0, Math.max(0.5, tempo / pitchRatio));
    filters.push(`atempo=${compensatingTempo.toFixed(4)}`);
  } else {
    filters.push(...buildAtempoChain(tempo));
  }

  const bassDb = Number(dsp.bassDb) || 0;
  if (Math.abs(bassDb) >= 0.5) {
    filters.push(`equalizer=f=90:t=q:w=1.1:g=${bassDb.toFixed(1)}`);
  }

  const trebleDb = Number(dsp.trebleDb) || 0;
  if (Math.abs(trebleDb) >= 0.5) {
    filters.push(`equalizer=f=9500:t=q:w=1.0:g=${trebleDb.toFixed(1)}`);
  }

  if (dsp.lofiWarmth) {
    filters.push('highpass=f=180', 'lowpass=f=3600', 'equalizer=f=380:t=q:w=1.2:g=2.5');
  }

  const reverbWet = Number(dsp.reverbWet) || 0;
  if (reverbWet > 5) {
    const decay = Math.min(0.85, Math.max(0.18, (reverbWet / 100) * 0.72)).toFixed(2);
    filters.push(`aecho=0.8:0.88:55|110:${decay}|${(Number(decay) * 0.65).toFixed(2)}`);
  }

  const fadeIn = Number(dsp.fadeInSec) || 0;
  if (fadeIn > 0.1) {
    filters.push(`afade=t=in:st=0:d=${fadeIn.toFixed(2)}`);
  }

  const fadeOut = Number(dsp.fadeOutSec) || 0;
  if (fadeOut > 0.1 && opts?.totalDurationSec && opts.totalDurationSec > fadeOut + 0.5) {
    const st = Math.max(0.2, opts.totalDurationSec - fadeOut);
    filters.push(`afade=t=out:st=${st.toFixed(2)}:d=${fadeOut.toFixed(2)}`);
  }

  if (dsp.normalizeLufs !== false) {
    filters.push('loudnorm=I=-14:TP=-1.5:LRA=11');
  }

  const afString = filters.length > 0 ? filters.join(',') : 'anull';
  const format = opts?.format || 'mp3';
  const codecArgs =
    format === 'wav'
      ? ['-c:a', 'pcm_s16le']
      : ['-c:a', 'libmp3lame', '-b:a', '256k'];

  await execFileAsync(
    'ffmpeg',
    ['-y', '-i', inputPath, '-vn', '-af', afString, '-ar', '44100', '-ac', '2', ...codecArgs, outPath],
    { timeout: 90000 }
  );
}

export async function separateStemsFfmpeg(
  inputPath: string,
  outDir: string
): Promise<{
  vocalsPath: string;
  instrumentalPath: string;
  bassPath: string;
  drumsPath: string;
}> {
  const vocalsPath = path.join(outDir, 'stem_vocals.mp3');
  const instrumentalPath = path.join(outDir, 'stem_instrumental.mp3');
  const bassPath = path.join(outDir, 'stem_bass.mp3');
  const drumsPath = path.join(outDir, 'stem_drums.mp3');

  // 1. Center Vocal Bandpass (Center L+R mix + vocal formant window 260Hz-3800Hz)
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-af',
      'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,highpass=f=240,lowpass=f=3900,compand',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      vocalsPath,
    ],
    { timeout: 60000 }
  );

  // 2. Instrumental / Karaoke Side-Channel + Low-High Harmonic Blend
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-af',
      'pan=stereo|c0=c0-0.85*c1|c1=c1-0.85*c0,equalizer=f=120:t=q:w=1.0:g=4,loudnorm=I=-15:TP=-1.5',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      instrumentalPath,
    ],
    { timeout: 60000 }
  );

  // 3. Sub Bass Isolation (<185Hz)
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-af',
      'lowpass=f=185,equalizer=f=70:t=q:w=1.0:g=4',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      bassPath,
    ],
    { timeout: 60000 }
  );

  // 4. Percussion / High-Transient Band (Kick punch + Snare/Hi-hat air)
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-af',
      'bandpass=f=4500:w=3000,equalizer=f=100:t=q:w=0.8:g=5,compand=attacks=0.005:decays=0.08:points=-70/-70|-25/-15|0/-3',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      drumsPath,
    ],
    { timeout: 60000 }
  );

  return { vocalsPath, instrumentalPath, bassPath, drumsPath };
}

export async function concatAudioCrossfadeFfmpeg(
  firstPath: string,
  secondPath: string,
  outPath: string,
  format: 'mp3' | 'wav' = 'mp3'
): Promise<void> {
  const codecArgs =
    format === 'wav'
      ? ['-c:a', 'pcm_s16le']
      : ['-c:a', 'libmp3lame', '-b:a', '256k'];

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        firstPath,
        '-i',
        secondPath,
        '-filter_complex',
        '[0:a][1:a]acrossfade=d=2.2:c1=tri:c2=tri,loudnorm=I=-14:TP=-1.5[outa]',
        '-map',
        '[outa]',
        '-ar',
        '44100',
        '-ac',
        '2',
        ...codecArgs,
        outPath,
      ],
      { timeout: 90000 }
    );
  } catch {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        firstPath,
        '-i',
        secondPath,
        '-filter_complex',
        '[0:a][1:a]concat=n=2:v=0:a=1[outa]',
        '-map',
        '[outa]',
        '-ar',
        '44100',
        '-ac',
        '2',
        ...codecArgs,
        outPath,
      ],
      { timeout: 90000 }
    );
  }
}

export async function generateTtsProducerTagBuffer(
  client: GoogleGenAI,
  tagText: string,
  voiceName = 'Kore'
): Promise<Buffer> {
  const response = await client.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: tagText,
            speechMetadata: {
              style: 'Crisp confident studio producer drop vocal tag',
            },
          } as any,
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('TTS returned no producer tag audio.');
  }
  return Buffer.from(base64Audio, 'base64');
}

export async function mixProducerTagIntoTrackFfmpeg(
  trackPath: string,
  tagWavPath: string,
  outPath: string,
  format: 'mp3' | 'wav' = 'mp3'
): Promise<void> {
  const codecArgs =
    format === 'wav'
      ? ['-c:a', 'pcm_s16le']
      : ['-c:a', 'libmp3lame', '-b:a', '256k'];

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      trackPath,
      '-i',
      tagWavPath,
      '-filter_complex',
      '[0:a]volume=0.88[bg];[1:a]adelay=350|350,volume=1.35,aecho=0.8:0.85:60:0.25[tag];[bg][tag]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-14:TP=-1.5[outa]',
      '-map',
      '[outa]',
      '-ar',
      '44100',
      '-ac',
      '2',
      ...codecArgs,
      outPath,
    ],
    { timeout: 60000 }
  );
}

export function normalizeMusicConfig(raw?: Partial<MusicConfig> | null): MusicConfig {
  return {
    ...DEFAULT_MUSIC_CONFIG,
    ...(raw || {}),
    vocal: { ...DEFAULT_MUSIC_CONFIG.vocal, ...(raw?.vocal || {}) },
    production: { ...DEFAULT_MUSIC_CONFIG.production, ...(raw?.production || {}) },
    dsp: { ...DEFAULT_MUSIC_CONFIG.dsp, ...(raw?.dsp || {}) },
  };
}

export function compileMusicPrompt(params: {
  prompt: string;
  title?: string;
  lyrics?: string;
  styleTags?: string[];
  config: MusicConfig;
}): string {
  const { config: cfg } = params;
  const tags = (params.styleTags || []).filter(Boolean);
  const genreLine = tags.length
    ? tags.join(', ')
    : `${cfg.primaryGenre}${cfg.secondaryGenre ? `, ${cfg.secondaryGenre}` : ''}`;

  const sections: string[] = [
    `Compose and produce a studio-quality musical track titled "${params.title || 'RaOne Studio Original'}".`,
    `Creative Direction: ${String(params.prompt || '').trim()}`,
    `Style & Genre Fusion: ${genreLine} (${cfg.production.era}).`,
    `Musicality: Tempo ${cfg.bpm} BPM, Key ${cfg.keySignature}, Time Signature ${cfg.production.timeSignature}, Mood: ${cfg.production.mood}.`,
    `Instrumentation: ${cfg.production.instruments.length ? cfg.production.instruments.join(', ') : 'Rich layered instrumentation'}.`,
    `Mix & Production: ${cfg.production.mixSpace}, ${cfg.production.masteringPreset}.`,
  ];

  if (cfg.mode === 'instrumental' || cfg.vocal.mode === 'instrumental') {
    sections.push('Arrangement Rule: Purely instrumental arrangement with ZERO singing vocals.');
  } else {
    sections.push(
      `Vocal Direction: ${cfg.vocal.mode.replace('_', ' ')} (${cfg.vocal.timbre}) sung in ${cfg.vocal.language}.`
    );
    if (params.lyrics && params.lyrics.trim()) {
      sections.push(`Lyrics Structure:\n${params.lyrics.trim()}`);
    }
  }

  if (cfg.negativePrompt.trim()) {
    sections.push(`Avoid: ${cfg.negativePrompt.trim()}.`);
  }

  return sections.join('\n');
}

export function compileMusicEditPrompt(params: {
  instruction: string;
  sourceAnalysis: string;
  sourceItem: GeneratedAudioItem;
  config: MusicConfig;
}): string {
  const { instruction, sourceAnalysis, sourceItem, config: cfg } = params;
  return [
    `Re-imagine and transform an existing musical recording titled "${sourceItem.title}".`,
    `Original Audio Analysis: ${sourceAnalysis}`,
    `User Edit / Remix Instruction: ${String(instruction).trim()}.`,
    `Target Genre & Style: ${cfg.primaryGenre}, ${cfg.secondaryGenre} (${cfg.production.era}).`,
    `Target Tempo & Key: ${cfg.bpm} BPM, ${cfg.keySignature}, Mood: ${cfg.production.mood}.`,
    `Instrumentation & Mix: ${cfg.production.instruments.join(', ')}; Mix: ${cfg.production.mixSpace}.`,
    cfg.vocal.mode === 'instrumental'
      ? 'Keep this edited version strictly instrumental without singing vocals.'
      : `Vocal Direction: ${cfg.vocal.timbre} in ${cfg.vocal.language}.`,
    sourceItem.lyrics && cfg.vocal.mode !== 'instrumental'
      ? `Preserve or adapt lyrics cleanly:\n${sourceItem.lyrics}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function enhanceMusicPromptServer(params: {
  prompt: string;
  enhancerMode?: MusicEnhancerMode;
  config?: MusicConfig;
  geminiClient: GoogleGenAI | null;
  byok: ByokKeyMap;
  fallbackGroqKey?: string;
}): Promise<{
  enhancedPrompt: string;
  suggestedTitle: string;
  suggestedBpm: number;
  suggestedKey: string;
  suggestedStyleTags: string[];
  suggestedLyrics: string;
  suggestedNegativePrompt: string;
  providerUsed: string;
  breakdown: MusicEnhanceBreakdown;
}> {
  const cfg = normalizeMusicConfig(params.config);
  const mode = params.enhancerMode || cfg.enhancerMode || 'auto';
  const cleanPrompt = String(params.prompt || '').trim();

  const styleBriefs: Record<MusicEnhancerMode, string> = {
    auto: 'Balanced modern Billboard & cinema production tailored naturally to the seed idea.',
    pop_rnb: 'Glossy Billboard radio Pop/R&B groove, catchy vocal hooks, tight sidechained sub bass and shimmering synths.',
    sri_lankan_fusion: 'Modern Sri Lankan fusion blending geta bera / yak bera rhythms, bansuri flute, electric guitars, and contemporary electronic drops.',
    cinematic_orchestral: 'Wide Hans Zimmer theatrical orchestral hybrid with sweeping strings, taiko drums, deep brass swells and ethereal choir.',
    edm_club: 'High-energy festival progressive/electro house drop, euphoric build-ups, crisp risers and sub-heavy basslines.',
    lofi_ambient: 'Warm dusty Rhodes keys, jazzy 7th chords, mellow acoustic texture, subtle rain vinyl crackle and laid-back swing.',
    acoustic_unplugged: 'Intimate wooden studio acoustic fingerstyle guitar, grand piano, upright bass and raw emotive vocal presence.',
  };

  const systemGuide = `You are a Grammy-level Music Producer & Songwriter Architect.
Expand even a 2-word user idea into a rich, structured, production-ready musical brief + song specs + lyrics.
Context:
- Producer Profile: ${styleBriefs[mode]}
- Vocal Language Preference: ${cfg.vocal.language}
- Vocal Mode: ${cfg.vocal.mode}

Return STRICT VALID JSON with keys:
{
  "enhancedPrompt": "vivid 2-3 sentence production brief describing instrumentation, groove, chord mood, vocal texture, and dynamic arc",
  "suggestedTitle": "2-4 word memorable song title",
  "suggestedBpm": 118,
  "suggestedKey": "D Minor",
  "suggestedStyleTags": ["Tag1", "Tag2", "Tag3", "Tag4"],
  "suggestedLyrics": "[Verse 1]...\\n[Pre-Chorus]...\\n[Chorus]...\\n[Bridge]...\\n[Outro]...",
  "suggestedNegativePrompt": "concise mix flaws to avoid",
  "breakdown": {
    "concept": "...",
    "arrangement": "...",
    "instrumentation": "...",
    "vocalDirection": "...",
    "mixNotes": "..."
  }
}`;

  const tryParseEnhancement = (rawText: string, providerUsed: string) => {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = /\{[\s\S]*\}/.exec(cleaned);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.enhancedPrompt) {
        return {
          enhancedPrompt: String(parsed.enhancedPrompt).trim(),
          suggestedTitle: String(parsed.suggestedTitle || cleanPrompt.slice(0, 32)).trim(),
          suggestedBpm: Math.min(190, Math.max(55, Number(parsed.suggestedBpm) || cfg.bpm)),
          suggestedKey: String(parsed.suggestedKey || cfg.keySignature).trim(),
          suggestedStyleTags: Array.isArray(parsed.suggestedStyleTags)
            ? parsed.suggestedStyleTags.map((x: any) => String(x).trim()).filter(Boolean)
            : [cfg.primaryGenre, cfg.production.mood],
          suggestedLyrics:
            cfg.vocal.mode === 'instrumental' ? '' : String(parsed.suggestedLyrics || '').trim(),
          suggestedNegativePrompt: String(
            parsed.suggestedNegativePrompt || cfg.negativePrompt
          ).trim(),
          providerUsed,
          breakdown: (parsed.breakdown || {}) as MusicEnhanceBreakdown,
        };
      }
    }
    return null;
  };

  if (params.geminiClient) {
    try {
      const response = await params.geminiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          role: 'user',
          parts: [{ text: `User music seed idea: "${cleanPrompt}"\nOutput ONLY valid JSON.` }],
        },
        config: {
          systemInstruction:
            appendRuntimeMetadata(SYSTEM_PROMPT, {
              provider: 'Google Gemini API',
              model: 'gemini-4-hydrogen',
              subsystem: 'RaOne Music Studio Prompt Architect',
            }) + `\n\n${systemGuide}`,
          responseMimeType: 'application/json',
        },
      });
      const parsed = tryParseEnhancement(response.text || '', 'Gemini 4 Hydrogen');
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('Music Gemini prompt enhance warning:', err?.message || err);
    }
  }

  const groqKey = params.byok?.groqApiKey || params.fallbackGroqKey;
  if (groqKey) {
    try {
      const res = await callGroqChat(
        groqKey,
        'raone-llama3-70b',
        [{ role: 'user', content: `User music seed idea: "${cleanPrompt}"\nOutput ONLY valid JSON.` }],
        `${SYSTEM_PROMPT}\n\n${systemGuide}`,
        1800
      );
      const parsed = tryParseEnhancement(res.text || '', res.modelUsed || 'Groq');
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('Music Groq prompt enhance warning:', err?.message || err);
    }
  }

  const localCfg = getActiveLocalEndpointConfig(params.byok || {});
  if (localCfg) {
    try {
      const res = await callLocalLlmChat({
        baseUrl: localCfg.baseUrl,
        modelId: localCfg.modelId,
        apiKey: localCfg.apiKey,
        messages: [],
        prompt: `User music seed idea: "${cleanPrompt}"\nOutput ONLY valid JSON.`,
        systemPrompt: `${SYSTEM_PROMPT}\n\n${systemGuide}`,
      });
      const parsed = tryParseEnhancement(res.text || '', localCfg.modelId || 'Local LLM');
      if (parsed) return parsed;
    } catch {
      // fall through to deterministic fallback
    }
  }

  return {
    enhancedPrompt: `${cleanPrompt}, arranged in ${cfg.primaryGenre} at ${cfg.bpm} BPM in ${cfg.keySignature} with layered ${cfg.production.instruments.join(', ')}, dynamic verse-to-chorus lift, and ${cfg.production.mixSpace.toLowerCase()} mastering.`,
    suggestedTitle: cleanPrompt
      .split(/\s+/)
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Studio Creation',
    suggestedBpm: cfg.bpm,
    suggestedKey: cfg.keySignature,
    suggestedStyleTags: [cfg.primaryGenre, cfg.production.mood, cfg.production.era],
    suggestedLyrics:
      cfg.vocal.mode === 'instrumental'
        ? ''
        : `[Verse 1]\nNeon echoes over ${cleanPrompt}\nEvery heartbeat locking into time\n\n[Chorus]\nTurn the signal up and let it fly\nUnderneath the silver velvet sky`,
    suggestedNegativePrompt: cfg.negativePrompt,
    providerUsed: 'RaOne Deterministic Music Producer',
    breakdown: {
      concept: cleanPrompt,
      arrangement: `Intro → Verse → Chorus → Bridge → Outro (${cfg.bpm} BPM)`,
      instrumentation: cfg.production.instruments.join(', '),
      vocalDirection: `${cfg.vocal.timbre} (${cfg.vocal.language})`,
      mixNotes: `${cfg.production.mixSpace} · ${cfg.production.masteringPreset}`,
    },
  };
}

export async function generateLyriaTrackBuffer(
  client: GoogleGenAI,
  compiledPrompt: string,
  modelId: 'lyria-3-pro-preview' | 'lyria-3-clip-preview' = 'lyria-3-pro-preview'
): Promise<{ buffer: Buffer; mimeType: string; lyrics?: string; modelUsed: string }> {
  const targetModel = modelId === 'lyria-3-clip-preview' ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview';
  const stream = await client.models.generateContentStream({
    model: targetModel,
    contents: compiledPrompt,
  });

  const audioChunks: Buffer[] = [];
  let lyrics = '';
  let mimeType = 'audio/wav';

  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (audioChunks.length === 0 && part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
      }
      if (part.text) {
        lyrics += part.text;
      }
    }
  }

  if (audioChunks.length === 0) {
    throw new Error(`Lyria model (${targetModel}) returned no audio stream.`);
  }

  return {
    buffer: Buffer.concat(audioChunks),
    mimeType,
    lyrics: lyrics.trim() || undefined,
    modelUsed: targetModel,
  };
}

export async function analyzeAudioTrackForEdit(
  client: GoogleGenAI,
  audioPath: string,
  userEditInstruction: string
): Promise<string> {
  try {
    const buf = await fs.promises.readFile(audioPath);
    const ext = path.extname(audioPath).toLowerCase();
    const mimeType = ext === '.wav' ? 'audio/wav' : ext === '.flac' ? 'audio/flac' : 'audio/mp3';
    const response = await client.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: buf.toString('base64'),
            },
          },
          {
            text: `Listen closely to this audio track and concisely describe its estimated BPM, musical key, instrumentation, vocal delivery, melody groove, and any lyrics you hear so a music producer can transform it according to: "${userEditInstruction}". Output a crisp 2-3 sentence production analysis.`,
          },
        ],
      },
    });
    return (response.text || '').trim();
  } catch (err: any) {
    console.warn('Multimodal audio analysis fallback:', err?.message || err);
    return `Existing musical recording ready to be transformed according to "${userEditInstruction}".`;
  }
}

export function buildProceduralCoverSvg(title: string, genre: string, seed: number): Buffer {
  const paletteIdx = Math.abs(seed) % 4;
  const palettes = [
    ['#0F172A', '#1E3A8A', '#F59E0B'],
    ['#18181B', '#4C1D95', '#38BDF8'],
    ['#141E1B', '#065F46', '#FBBF24'],
    ['#1F1215', '#881337', '#FB923C'],
  ];
  const [c1, c2, c3] = palettes[paletteIdx];
  const safeTitle = String(title || 'RaOne Track').replace(/[<>&"]/g, '').slice(0, 28);
  const safeGenre = String(genre || 'AI Master').replace(/[<>&"]/g, '').slice(0, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="60%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="#090A0D"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="220" r="115" fill="none" stroke="${c3}" stroke-opacity="0.45" stroke-width="2"/>
  <circle cx="256" cy="220" r="76" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="1.5"/>
  <circle cx="256" cy="220" r="20" fill="${c3}" fill-opacity="0.85"/>
  <text x="44" y="422" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="28" font-weight="600">${safeTitle}</text>
  <text x="44" y="456" fill="#D1D5DB" font-family="system-ui,sans-serif" font-size="16">${safeGenre}</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

export async function generateMusicCoverArtBuffer(
  client: GoogleGenAI | null,
  title: string,
  genre: string,
  mood: string,
  seed: number
): Promise<{ buffer: Buffer; ext: 'jpg' | 'svg' }> {
  if (client) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: `Minimalist album cover artwork for "${title}", musical aesthetic: ${genre}, mood: ${mood}. Rich editorial photography / abstract vinyl geometry, zero text or letters on cover.`,
        config: {
          imageConfig: {
            aspectRatio: '1:1',
          },
        },
      });
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          return {
            buffer: Buffer.from(part.inlineData.data, 'base64'),
            ext: 'jpg',
          };
        }
      }
    } catch (err: any) {
      console.warn('Music cover art generation fallback to SVG:', err?.message || err);
    }
  }
  return {
    buffer: buildProceduralCoverSvg(title, genre, seed),
    ext: 'svg',
  };
}

export async function finalizeMusicTrackRecord(params: {
  tenantId: string;
  id: string;
  rawAudioBuffer: Buffer;
  rawInputExt?: string;
  coverClient?: GoogleGenAI | null;
  existingCoverUrl?: string;
  existingCoverFilename?: string;
  title: string;
  prompt: string;
  compiledPrompt: string;
  enhancedFrom?: string;
  editInstruction?: string;
  lyrics?: string;
  styleTags: string[];
  config: MusicConfig;
  operationType: MusicOperationType;
  parentId?: string | null;
  rootId?: string | null;
  version?: number;
  sourceAudioUrl?: string;
  engineModelUsed?: string;
  clonedVoiceName?: string;
  extended?: boolean;
  trimmed?: boolean;
  mastered?: boolean;
  trimRange?: { start: number; end: number };
  aiNotes?: string;
  skipNormalize?: boolean;
}): Promise<GeneratedAudioItem> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-mus-'));
  try {
    const inExt = params.rawInputExt || '.wav';
    const rawTmp = path.join(tmpDir, `${params.id}_raw${inExt.startsWith('.') ? inExt : `.${inExt}`}`);
    await fs.promises.writeFile(rawTmp, params.rawAudioBuffer);

    const outFormat = params.config.production.outputFormat === 'wav' ? 'wav' : 'mp3';
    const finalTmp = path.join(tmpDir, `${params.id}_final.${outFormat}`);

    if (params.skipNormalize) {
      await fs.promises.copyFile(rawTmp, finalTmp);
    } else {
      await transcodeNormalizeAudio(
        rawTmp,
        finalTmp,
        outFormat,
        params.config.dsp.normalizeLufs !== false
      );
    }

    const finalBuf = await fs.promises.readFile(finalTmp);
    const probe = await probeAudioFile(finalTmp);
    const audioAsset = await saveTenantMusicAssetBuffer(
      params.tenantId,
      params.id,
      outFormat,
      finalBuf
    );

    let coverUrl = params.existingCoverUrl || '';
    let coverFilename = params.existingCoverFilename;

    if (!coverUrl) {
      const coverData = await generateMusicCoverArtBuffer(
        params.config.production.generateCoverArt ? params.coverClient || null : null,
        params.title,
        params.styleTags[0] || params.config.primaryGenre,
        params.config.production.mood,
        params.config.seed
      );
      const savedCover = await saveTenantMusicAssetBuffer(
        params.tenantId,
        `${params.id}_cover`,
        coverData.ext,
        coverData.buffer
      );
      coverUrl = savedCover.url;
      coverFilename = savedCover.filename;
    }

    return {
      id: params.id,
      parentId: params.parentId ?? null,
      rootId: params.rootId ?? params.id,
      version: params.version ?? 1,
      operationType: params.operationType,
      title: params.title,
      prompt: params.prompt,
      compiledPrompt: params.compiledPrompt,
      enhancedFrom: params.enhancedFrom,
      editInstruction: params.editInstruction,
      negativePrompt: params.config.negativePrompt,
      lyrics: params.lyrics || undefined,
      styleTags: params.styleTags,
      model: params.config.model,
      engineModelUsed: params.engineModelUsed || params.config.enginePreference,
      isInstrumental:
        params.config.mode === 'instrumental' || params.config.vocal.mode === 'instrumental',
      duration: probe.duration,
      bpm: params.config.bpm,
      keySignature: params.config.keySignature,
      timeSignature: params.config.production.timeSignature,
      mood: params.config.production.mood,
      instruments: params.config.production.instruments,
      audioUrl: audioAsset.url,
      sourceAudioUrl: params.sourceAudioUrl,
      coverUrl,
      assetFilename: audioAsset.filename,
      coverFilename,
      mimeType: outFormat === 'wav' ? 'audio/wav' : 'audio/mpeg',
      format: outFormat.toUpperCase(),
      sampleRate: probe.sampleRate,
      channels: probe.channels,
      bitrateKbps: probe.bitrateKbps,
      fileSizeBytes: probe.fileSizeBytes,
      clonedVoiceName: params.clonedVoiceName,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      extended: Boolean(params.extended),
      trimmed: Boolean(params.trimmed),
      mastered: Boolean(params.mastered || params.config.dsp.normalizeLufs),
      trimRange: params.trimRange,
      playCount: 0,
      seed: params.config.seed,
      aiNotes: params.aiNotes,
      configSnapshot: params.config,
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
