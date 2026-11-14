import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { callGroqChat } from './server_groq_service.ts';
import { getActiveLocalEndpointConfig, callLocalLlmChat } from './server_local_llm.ts';
import { SYSTEM_PROMPT, appendRuntimeMetadata } from './src/lib/systemPrompts.ts';
import type { ByokKeyMap } from './server_tenant_store.ts';
import {
  DEFAULT_CINEMA_CONFIG,
  type CinemaConfig,
  type CinemaEnhanceBreakdown,
  type CinemaEnhancerMode,
  type CinemaOperationType,
  type CinemaResolutionTier,
} from './src/types/cinema.ts';
import type { GeneratedVideoItem } from './src/types/index.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.join(__dirname, 'data', 'tenants');

export interface VideoProbeInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
  fileSizeBytes: number;
}

export interface CinemaPublishedSnapshot {
  shareId: string;
  tenantId: string;
  videoId: string;
  title: string;
  prompt: string;
  compiledPrompt: string;
  model: string;
  aspectRatio: string;
  dimensions: string;
  duration: number;
  fps: number;
  seed: number;
  videoFilename: string;
  posterFilename: string;
  publishedAt: string;
}

function safeSegment(value: string): string {
  return String(value || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 96);
}

export function getTenantCinemaAssetDir(tenantId: string): string {
  const dir = path.join(DATA_ROOT, safeSegment(tenantId), 'cinema_assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveTenantCinemaAssetPath(tenantId: string, filename: string): string | null {
  const clean = path.basename(String(filename || '').trim());
  if (!clean || clean === '.' || clean === '..' || !/^[a-zA-Z0-9._-]+$/.test(clean)) {
    return null;
  }
  const dir = getTenantCinemaAssetDir(tenantId);
  const resolved = path.resolve(dir, clean);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    return null;
  }
  return resolved;
}

export async function saveTenantCinemaAssetBuffer(
  tenantId: string,
  baseId: string,
  ext: 'mp4' | 'jpg' | 'png' | 'webp' | 'wav' | 'mp3',
  buffer: Buffer
): Promise<{ filename: string; filePath: string; url: string }> {
  const dir = getTenantCinemaAssetDir(tenantId);
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 8);
  const filename = `${safeSegment(baseId)}_${hash}.${ext}`;
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return {
    filename,
    filePath,
    url: `/api/motion/assets/${encodeURIComponent(filename)}`,
  };
}

export async function deleteTenantCinemaAssets(tenantId: string, filenames: Array<string | undefined | null>): Promise<void> {
  for (const name of filenames) {
    if (!name) continue;
    const p = resolveTenantCinemaAssetPath(tenantId, name);
    if (p && fs.existsSync(p)) {
      await fs.promises.unlink(p).catch(() => {});
    }
  }
}

export function streamCinemaAssetWithRange(req: Request, res: Response, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp4'
      ? 'video/mp4'
      : ext === '.webm'
      ? 'video/webm'
      : ext === '.mov'
      ? 'video/quicktime'
      : ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.png'
      ? 'image/png'
      : ext === '.wav'
      ? 'audio/wav'
      : ext === '.mp3'
      ? 'audio/mpeg'
      : 'application/octet-stream';

  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

  if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
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

export async function probeVideoFile(filePath: string): Promise<VideoProbeInfo> {
  const stat = await fs.promises.stat(filePath);
  const fallback: VideoProbeInfo = {
    duration: 5,
    width: 1280,
    height: 720,
    fps: 24,
    hasAudio: false,
    codec: 'h264',
    fileSizeBytes: stat.size,
  };

  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      { timeout: 15000 }
    );
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    const audioStream = streams.find((s: any) => s.codec_type === 'audio');
    const dur = Number(parsed?.format?.duration || videoStream?.duration || 5);

    let fps = 24;
    const rawRate = String(videoStream?.avg_frame_rate || videoStream?.r_frame_rate || '24/1');
    if (rawRate.includes('/')) {
      const [num, den] = rawRate.split('/').map(Number);
      if (num > 0 && den > 0) {
        fps = Math.round(num / den);
      }
    } else if (Number(rawRate) > 0) {
      fps = Math.round(Number(rawRate));
    }

    return {
      duration: Number.isFinite(dur) && dur > 0 ? Number(dur.toFixed(2)) : 5,
      width: Number(videoStream?.width) || 1280,
      height: Number(videoStream?.height) || 720,
      fps: Math.min(120, Math.max(12, fps || 24)),
      hasAudio: Boolean(audioStream),
      codec: String(videoStream?.codec_name || 'h264'),
      fileSizeBytes: stat.size,
    };
  } catch {
    return fallback;
  }
}

export async function extractPosterFrame(
  videoPath: string,
  outJpgPath: string,
  timestampSec = 0.25
): Promise<boolean> {
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(Math.max(0, timestampSec)),
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outJpgPath,
      ],
      { timeout: 20000 }
    );
    return fs.existsSync(outJpgPath) && fs.statSync(outJpgPath).size > 0;
  } catch {
    try {
      await execFileAsync(
        'ffmpeg',
        ['-y', '-i', videoPath, '-frames:v', '1', '-q:v', '3', outJpgPath],
        { timeout: 20000 }
      );
      return fs.existsSync(outJpgPath) && fs.statSync(outJpgPath).size > 0;
    } catch {
      return false;
    }
  }
}

export async function transcodeNormalizeUpload(inputPath: string, outMp4Path: string): Promise<void> {
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      '-t',
      '30',
      outMp4Path,
    ],
    { timeout: 90000 }
  );
}

export async function trimVideoFfmpeg(
  inputPath: string,
  outMp4Path: string,
  startSec: number,
  endSec: number
): Promise<void> {
  const safeStart = Math.max(0, Number(startSec) || 0);
  const duration = Math.max(0.5, (Number(endSec) || safeStart + 1) - safeStart);
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      safeStart.toFixed(2),
      '-i',
      inputPath,
      '-t',
      duration.toFixed(2),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outMp4Path,
    ],
    { timeout: 90000 }
  );
}

export async function applyAspectCropFfmpeg(
  inputPath: string,
  outMp4Path: string,
  aspectRatio: string
): Promise<boolean> {
  const exprMap: Record<string, string> = {
    '1:1': "crop='min(iw,ih)':'min(iw,ih)'",
    '4:3': "crop='if(gt(iw/ih,4/3),ih*4/3,iw)':'if(gt(iw/ih,4/3),ih,iw*3/4)'",
    '21:9': "crop='iw':'trunc(iw*9/21/2)*2'",
  };
  const vf = exprMap[aspectRatio];
  if (!vf) return false;
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `${vf},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      outMp4Path,
    ],
    { timeout: 90000 }
  );
  return true;
}

export async function interpolate60FpsFfmpeg(inputPath: string, outMp4Path: string): Promise<void> {
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        outMp4Path,
      ],
      { timeout: 180000 }
    );
  } catch {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        'fps=60',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        outMp4Path,
      ],
      { timeout: 90000 }
    );
  }
}

export async function upscaleVideoFfmpeg(
  inputPath: string,
  outMp4Path: string,
  targetTier: '1080p' | '4k' = '4k'
): Promise<void> {
  const probe = await probeVideoFile(inputPath);
  const isPortrait = probe.height > probe.width;
  const targetWidth = targetTier === '4k' ? (isPortrait ? 2160 : 3840) : isPortrait ? 1080 : 1920;
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `scale=${targetWidth}:-2:flags=lanczos,unsharp=5:5:0.75:3:3:0.35`,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '17',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'copy',
      '-movflags',
      '+faststart',
      outMp4Path,
    ],
    { timeout: 180000 }
  );
}

export async function muxAudioFfmpeg(
  videoPath: string,
  audioPath: string,
  outMp4Path: string
): Promise<void> {
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      outMp4Path,
    ],
    { timeout: 90000 }
  );
}

export async function concatVideosFfmpeg(
  firstPath: string,
  secondPath: string,
  outMp4Path: string
): Promise<void> {
  const probeA = await probeVideoFile(firstPath);
  const w = probeA.width || 1280;
  const h = probeA.height || 720;
  const hasBothAudio = probeA.hasAudio && (await probeVideoFile(secondPath)).hasAudio;

  if (hasBothAudio) {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        firstPath,
        '-i',
        secondPath,
        '-filter_complex',
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${probeA.fps}[v0];` +
          `[1:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${probeA.fps}[v1];` +
          `[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[v][a]`,
        '-map',
        '[v]',
        '-map',
        '[a]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outMp4Path,
      ],
      { timeout: 120000 }
    );
  } else {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        firstPath,
        '-i',
        secondPath,
        '-filter_complex',
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${probeA.fps}[v0];` +
          `[1:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${probeA.fps}[v1];` +
          `[v0][v1]concat=n=2:v=1:a=0[v]`,
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outMp4Path,
      ],
      { timeout: 120000 }
    );
  }
}

export async function resolveImageInputToInlinePart(
  tenantId: string,
  input: string
): Promise<{ data: string; mimeType: string } | null> {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;

  const dataMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(trimmed);
  if (dataMatch) {
    return { mimeType: dataMatch[1], data: dataMatch[2] };
  }

  if (trimmed.startsWith('/api/motion/assets/')) {
    const filename = decodeURIComponent(trimmed.split('/').pop() || '');
    const assetPath = resolveTenantCinemaAssetPath(tenantId, filename);
    if (assetPath && fs.existsSync(assetPath)) {
      const buf = await fs.promises.readFile(assetPath);
      const ext = path.extname(assetPath).toLowerCase();
      return {
        mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png',
        data: buf.toString('base64'),
      };
    }
  }

  if (trimmed.startsWith('/api/vision/assets/')) {
    const filename = decodeURIComponent(trimmed.split('/').pop() || '');
    const visionDir = path.join(DATA_ROOT, safeSegment(tenantId), 'vision_assets');
    const clean = path.basename(filename);
    const fullPath = path.resolve(visionDir, clean);
    if (fullPath.startsWith(path.resolve(visionDir) + path.sep) && fs.existsSync(fullPath)) {
      const buf = await fs.promises.readFile(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      return {
        mimeType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png',
        data: buf.toString('base64'),
      };
    }
  }

  return null;
}

export function normalizeCinemaConfig(raw?: Partial<CinemaConfig> | null): CinemaConfig {
  return {
    ...DEFAULT_CINEMA_CONFIG,
    ...(raw || {}),
    camera: { ...DEFAULT_CINEMA_CONFIG.camera, ...(raw?.camera || {}) },
    look: { ...DEFAULT_CINEMA_CONFIG.look, ...(raw?.look || {}) },
    audio: { ...DEFAULT_CINEMA_CONFIG.audio, ...(raw?.audio || {}) },
    edit: { ...DEFAULT_CINEMA_CONFIG.edit, ...(raw?.edit || {}) },
  };
}

export function computeCinemaDimensions(aspectRatio: string, resolution: CinemaResolutionTier): string {
  const heightMap: Record<CinemaResolutionTier, number> = {
    '360p': 360,
    '720p': 720,
    '1080p': 1080,
    '4k': 2160,
  };
  const h = heightMap[resolution] || 720;
  if (aspectRatio === '9:16') return `${Math.round((h * 9) / 16)}x${h}`;
  if (aspectRatio === '1:1') return `${h}x${h}`;
  if (aspectRatio === '4:3') return `${Math.round((h * 4) / 3)}x${h}`;
  if (aspectRatio === '21:9') return `${Math.round((h * 21) / 9)}x${h}`;
  return `${Math.round((h * 16) / 9)}x${h}`;
}

export function compileCinemaPrompt(userPrompt: string, cfg: CinemaConfig): string {
  const parts: string[] = [String(userPrompt || '').trim()];

  const cameraClause = [
    cfg.camera.trajectory && cfg.camera.trajectory !== 'Static Camera (Tripod)'
      ? `camera movement: ${cfg.camera.trajectory} (${cfg.camera.speed} pacing, motion intensity ${cfg.camera.motionStrength}/10)`
      : 'tripod locked camera perspective',
    `${cfg.camera.stabilization} rig`,
    `${cfg.camera.focalLength} lens`,
    `${cfg.camera.aperture}`,
    `${cfg.camera.shutterRule}`,
  ].join(', ');

  const lookClause = [
    `visual style: ${cfg.look.visualStyle}`,
    `lighting: ${cfg.look.lighting}`,
    `color grading: ${cfg.look.colorGrade}`,
    `film stock: ${cfg.look.filmStock}`,
    cfg.look.weatherParticles && cfg.look.weatherParticles !== 'None / Clear'
      ? `atmospheric particles: ${cfg.look.weatherParticles}`
      : '',
    `editorial rhythm: ${cfg.look.pacing}`,
  ]
    .filter(Boolean)
    .join(', ');

  parts.push(`Cinematography: ${cameraClause}.`);
  parts.push(`Art Direction: ${lookClause}.`);

  if (cfg.audio.audioMode === 'ambient_foley' || cfg.audio.audioMode === 'native') {
    if (cfg.audio.audioPrompt.trim()) {
      parts.push(`Sound & Foley: ${cfg.audio.audioPrompt.trim()}.`);
    }
    if (cfg.audio.voiceoverCue.trim()) {
      parts.push(`Dialogue / Voice Cue: ${cfg.audio.voiceoverCue.trim()}.`);
    }
  }

  if (cfg.negativePrompt.trim()) {
    parts.push(`Avoid: ${cfg.negativePrompt.trim()}.`);
  }

  return parts.join(' ');
}

export function compileCinemaEditPrompt(
  instruction: string,
  cfg: CinemaConfig,
  opts?: { hasMask?: boolean; hasReferenceImages?: boolean }
): string {
  const presetDirections: Record<string, string> = {
    restyle: 'Transform the visual art style, lighting, and color palette across every frame while strictly preserving original motion choreography and subject silhouette.',
    object_swap: 'Replace or modify the target subject/object as instructed while preserving camera trajectory, background environment, shadows, and lighting continuity.',
    background_replace: 'Keep the foreground subjects and their exact motion untouched while replacing the background environment seamlessly with matching depth and reflections.',
    weather_lighting: 'Keep all geometry, subjects, and camera motion identical while transforming time of day, weather physics, and volumetric lighting.',
    character_swap: 'Replace the character appearance using the instruction/reference while keeping exact pose, timing, camera angle, and scene physics.',
    custom: 'Modify the video strictly according to the editing instruction while maintaining temporal coherence and physical continuity across frames.',
  };

  const parts = [
    presetDirections[cfg.edit.preset] || presetDirections.custom,
    `Edit Instruction: ${String(instruction || '').trim()}.`,
    `Preserve untouched regions and temporal coherence at ${cfg.edit.preservationStrength}% fidelity.`,
  ];

  if (opts?.hasMask) {
    parts.push(
      `Apply the edit and motion change specifically inside the highlighted region shown in the attached mask overlay, with motion vector "${cfg.edit.motionBrushDirection}". Keep unmasked areas consistent.`
    );
  }
  if (opts?.hasReferenceImages) {
    parts.push('Incorporate the visual identity/style from the attached reference image(s).');
  }
  if (cfg.look.lighting && cfg.look.lighting !== 'Natural') {
    parts.push(`Target lighting mood: ${cfg.look.lighting}, color grade: ${cfg.look.colorGrade}.`);
  }
  if (cfg.negativePrompt.trim()) {
    parts.push(`Avoid: ${cfg.negativePrompt.trim()}.`);
  }
  return parts.join(' ');
}

export async function enhanceCinemaPromptServer(params: {
  prompt: string;
  enhancerMode?: CinemaEnhancerMode;
  config?: CinemaConfig;
  geminiClient: GoogleGenAI | null;
  byok: ByokKeyMap;
  fallbackGroqKey?: string;
}): Promise<{
  enhancedPrompt: string;
  suggestedNegativePrompt: string;
  suggestedAudioCue: string;
  providerUsed: string;
  breakdown: CinemaEnhanceBreakdown;
}> {
  const cfg = normalizeCinemaConfig(params.config);
  const mode = params.enhancerMode || cfg.enhancerMode || 'auto';
  const cleanPrompt = String(params.prompt || '').trim();

  const styleBriefs: Record<CinemaEnhancerMode, string> = {
    auto: 'Balanced Silicon Valley film director treatment with rich physical realism, natural depth, and smooth temporal continuity.',
    hollywood: 'Hollywood theatrical blockbuster 70mm anamorphic IMAX aesthetic, dramatic chiaroscuro rim lighting, dynamic Steadicam/crane choreography, rich film grain.',
    commercial: 'Ultra-crisp luxury commercial shoot, studio macro highlights, slow-motion fluid droplets or sleek metallic reflections, high-contrast clean palette.',
    anime: 'High-budget theatrical anime cinematography (Makoto Shinkai / Ufotable quality), volumetric sakuga lighting, expressive speed lines, atmospheric bokeh.',
    drone_doc: 'Aerial cinema FPV / Inspire 3 sweeping landscape cinematography, golden hour haze, hyper-realistic terrain textures, smooth orbital trajectories.',
    scifi_vfx: 'Industrial sci-fi VFX showcase, bioluminescent/volumetric fog particles, cybernetic physics, realistic ray-traced reflections and micro-scratches.',
  };

  const systemGuide = `You are a world-class Film Director and Generative Video Prompt Architect.
Expand even a 2-word user idea into a vivid, temporal-aware, physically coherent cinema video prompt.
Selected aesthetic lens/rig context:
- Mode style: ${styleBriefs[mode]}
- Camera: ${cfg.camera.trajectory}, ${cfg.camera.focalLength}, ${cfg.camera.aperture}, ${cfg.camera.stabilization}
- Lighting & LUT: ${cfg.look.lighting}, ${cfg.look.colorGrade}, Weather: ${cfg.look.weatherParticles}
- Duration target: ${cfg.duration}s

Return STRICT VALID JSON with keys:
{
  "enhancedPrompt": "one rich paragraph describing action across time (beginning -> climax -> settle), camera movement, lighting, physics, texture, atmosphere",
  "suggestedNegativePrompt": "concise comma-separated artifacts to avoid",
  "suggestedAudioCue": "ambient soundscape, foley effects, and music cue suitable for this shot",
  "breakdown": {
    "subject": "...",
    "camera": "...",
    "lighting": "...",
    "physics": "...",
    "colorGrade": "...",
    "audioCue": "..."
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
          suggestedNegativePrompt: String(
            parsed.suggestedNegativePrompt || cfg.negativePrompt
          ).trim(),
          suggestedAudioCue: String(parsed.suggestedAudioCue || '').trim(),
          providerUsed,
          breakdown: (parsed.breakdown || {}) as CinemaEnhanceBreakdown,
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
          parts: [{ text: `User prompt: "${cleanPrompt}"\nOutput ONLY valid JSON.` }],
        },
        config: {
          systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
            provider: 'Google Gemini API',
            model: 'gemini-4-hydrogen',
            subsystem: 'RaOne Cinema Studio Prompt Architect',
          }) + `\n\n${systemGuide}`,
          responseMimeType: 'application/json',
        },
      });
      const parsed = tryParseEnhancement(response.text || '', 'Gemini 4 Hydrogen');
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('Cinema Gemini prompt enhance warning:', err?.message || err);
    }
  }

  const groqKey = params.byok?.groqApiKey || params.fallbackGroqKey;
  if (groqKey) {
    try {
      const res = await callGroqChat(
        groqKey,
        'raone-llama3-70b',
        [{ role: 'user', content: `User prompt: "${cleanPrompt}"\nOutput ONLY valid JSON.` }],
        `${SYSTEM_PROMPT}\n\n${systemGuide}`,
        1400
      );
      const parsed = tryParseEnhancement(res.text || '', res.modelUsed || 'Groq');
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('Cinema Groq prompt enhance warning:', err?.message || err);
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
        prompt: `User prompt: "${cleanPrompt}"\nOutput ONLY valid JSON.`,
        systemPrompt: `${SYSTEM_PROMPT}\n\n${systemGuide}`,
      });
      const parsed = tryParseEnhancement(res.text || '', localCfg.modelId || 'Local LLM');
      if (parsed) return parsed;
    } catch {
      // fall through to deterministic director expansion
    }
  }

  // Deterministic director fallback (always works even offline)
  const fallbackEnhanced = `${cleanPrompt}, captured on ${cfg.camera.focalLength} at ${cfg.camera.aperture} using a ${cfg.camera.stabilization} executing a smooth ${cfg.camera.trajectory.toLowerCase()}, bathed in ${cfg.look.lighting.toLowerCase()} with ${cfg.look.colorGrade.toLowerCase()} color grading and natural temporal motion physics across ${cfg.duration} seconds.`;
  return {
    enhancedPrompt: fallbackEnhanced,
    suggestedNegativePrompt: cfg.negativePrompt,
    suggestedAudioCue: `Natural foley & atmospheric underscore matching ${cleanPrompt}`,
    providerUsed: 'RaOne Deterministic Cinema Architect',
    breakdown: {
      subject: cleanPrompt,
      camera: `${cfg.camera.trajectory} (${cfg.camera.focalLength})`,
      lighting: cfg.look.lighting,
      physics: `Temporal motion intensity ${cfg.camera.motionStrength}/10`,
      colorGrade: cfg.look.colorGrade,
      audioCue: `Atmospheric foley`,
    },
  };
}

export async function generateLyriaAudioBuffer(
  client: GoogleGenAI,
  audioPrompt: string
): Promise<{ buffer: Buffer; mimeType: string; lyrics?: string }> {
  const response = await client.models.generateContentStream({
    model: 'lyria-3-clip-preview',
    contents: audioPrompt,
  });

  let audioBase64 = '';
  let lyrics = '';
  let mimeType = 'audio/wav';

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (!audioBase64 && part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        audioBase64 += part.inlineData.data;
      }
      if (part.text && !lyrics) {
        lyrics = part.text;
      }
    }
  }

  if (!audioBase64) {
    throw new Error('Lyria audio model returned no audio stream.');
  }

  return {
    buffer: Buffer.from(audioBase64, 'base64'),
    mimeType,
    lyrics: lyrics || undefined,
  };
}

function mapOmniAspectRatio(aspectRatio: string): '16:9' | '9:16' {
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

function mapOmniDuration(durationSec: number, twoKeyframe: boolean): string {
  const maxD = twoKeyframe ? 10 : 15;
  const clamped = Math.min(maxD, Math.max(3, Math.round(durationSec || 5)));
  return `${clamped}s`;
}

function mapOmniResolution(tier: CinemaResolutionTier): '360p' | '720p' | '1080p' | '4k' {
  if (tier === '360p' || tier === '1080p' || tier === '4k') return tier;
  return '720p';
}

export async function uploadVideoToGeminiFiles(
  client: GoogleGenAI,
  localVideoPath: string,
  mimeType = 'video/mp4'
): Promise<{ uri: string; name: string }> {
  let videoFile = await client.files.upload({
    file: localVideoPath,
    config: { mimeType },
  });

  const maxWaitMs = 120000;
  const start = Date.now();
  while (videoFile.state === 'PROCESSING') {
    if (Date.now() - start > maxWaitMs) {
      throw new Error('Timed out while processing uploaded video for Gemini Omni.');
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
    videoFile = await client.files.get({ name: videoFile.name || '' });
  }
  if (videoFile.state === 'FAILED') {
    throw new Error('Gemini File API failed to process uploaded video.');
  }
  if (!videoFile.uri) {
    throw new Error('Gemini File API returned no file URI.');
  }
  return { uri: videoFile.uri, name: videoFile.name || '' };
}

export async function runGeminiOmniVideoGeneration(params: {
  client: GoogleGenAI;
  compiledPrompt: string;
  aspectRatio: string;
  durationSec: number;
  resolution: CinemaResolutionTier;
  referenceInlineImages?: Array<{ data: string; mimeType: string }>;
}): Promise<{ buffer: Buffer; mimeType: string; interactionId: string | null }> {
  const images = (params.referenceInlineImages || []).slice(0, 6);
  const twoKeyframe = images.length === 2;

  let input: any = params.compiledPrompt;
  if (images.length > 0) {
    input = [
      ...images.map((img) => ({
        type: 'image',
        mime_type: img.mimeType,
        data: img.data,
      })),
      {
        type: 'text',
        text: params.compiledPrompt,
      },
    ];
  }

  const interaction: any = await (params.client as any).interactions.create(
    {
      model: 'gemini-omni-1.2-flash',
      input,
      background: false,
      store: true,
      stream: false,
      response_format: {
        type: 'video',
        aspect_ratio: mapOmniAspectRatio(params.aspectRatio),
        duration: mapOmniDuration(params.durationSec, twoKeyframe),
        resolution: mapOmniResolution(params.resolution),
      },
    },
    { timeout: 300000 }
  );

  const videoPart = interaction?.output_video;
  if (!videoPart?.data) {
    throw new Error('Gemini Omni video model returned no video output.');
  }

  return {
    buffer: Buffer.from(videoPart.data, 'base64'),
    mimeType: videoPart.mime_type || 'video/mp4',
    interactionId: interaction?.id || null,
  };
}

export async function runGeminiOmniVideoEditOrExtend(params: {
  client: GoogleGenAI;
  compiledInstruction: string;
  previousInteractionId?: string | null;
  localVideoPath?: string | null;
  aspectRatio: string;
  durationSec?: number;
  resolution?: CinemaResolutionTier;
  extraInlineImages?: Array<{ data: string; mimeType: string }>;
}): Promise<{ buffer: Buffer; mimeType: string; interactionId: string | null }> {
  const extraImages = (params.extraInlineImages || []).slice(0, 5);
  const buildInput = (videoUri?: string) => {
    const items: any[] = [];
    if (videoUri) {
      items.push({ type: 'video', uri: videoUri });
    }
    for (const img of extraImages) {
      items.push({ type: 'image', mime_type: img.mimeType, data: img.data });
    }
    items.push({ type: 'text', text: params.compiledInstruction });
    return items.length === 1 && !videoUri ? params.compiledInstruction : items;
  };

  const responseFormat: Record<string, any> = {
    type: 'video',
    aspect_ratio: mapOmniAspectRatio(params.aspectRatio),
  };
  if (params.durationSec) {
    responseFormat.duration = `${Math.min(10, Math.max(3, Math.round(params.durationSec)))}s`;
  }
  if (params.resolution) {
    responseFormat.resolution = mapOmniResolution(params.resolution);
  }

  // Prefer stored interaction continuity when available; auto-fallback to File API upload if expired
  if (params.previousInteractionId) {
    try {
      const interaction: any = await (params.client as any).interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          previous_interaction_id: params.previousInteractionId,
          input: buildInput(),
          background: false,
          store: true,
          stream: false,
          response_format: responseFormat,
        },
        { timeout: 300000 }
      );
      if (interaction?.output_video?.data) {
        return {
          buffer: Buffer.from(interaction.output_video.data, 'base64'),
          mimeType: interaction.output_video.mime_type || 'video/mp4',
          interactionId: interaction?.id || null,
        };
      }
    } catch (turnErr: any) {
      if (!params.localVideoPath) throw turnErr;
      console.warn('Multi-turn interaction fallback to Files API upload:', turnErr?.message || turnErr);
    }
  }

  if (!params.localVideoPath || !fs.existsSync(params.localVideoPath)) {
    throw new Error('Source video file is unavailable for Video-to-Video editing.');
  }

  const uploaded = await uploadVideoToGeminiFiles(params.client, params.localVideoPath, 'video/mp4');
  const interaction: any = await (params.client as any).interactions.create(
    {
      model: 'gemini-omni-1.2-flash',
      input: buildInput(uploaded.uri),
      background: false,
      store: true,
      stream: false,
      response_format: responseFormat,
    },
    { timeout: 300000 }
  );

  const videoPart = interaction?.output_video;
  if (!videoPart?.data) {
    throw new Error('Gemini Omni video edit returned no video output.');
  }

  return {
    buffer: Buffer.from(videoPart.data, 'base64'),
    mimeType: videoPart.mime_type || 'video/mp4',
    interactionId: interaction?.id || null,
  };
}

export async function finalizeCinemaVideoRecord(params: {
  tenantId: string;
  id: string;
  rawVideoBuffer: Buffer;
  prompt: string;
  compiledPrompt: string;
  enhancedFrom?: string;
  editInstruction?: string;
  config: CinemaConfig;
  operationType: CinemaOperationType;
  parentId?: string | null;
  rootId?: string | null;
  version?: number;
  interactionId?: string | null;
  sourceVideoUrl?: string;
  referenceImage?: string | null;
  referenceImages?: string[];
  endKeyframeImage?: string | null;
  engineModelUsed?: string;
  trimRange?: { start: number; end: number };
  audioSynced?: boolean;
  extended?: boolean;
  interpolated?: boolean;
  upscaled?: boolean;
  trimmed?: boolean;
  aiNotes?: string;
}): Promise<GeneratedVideoItem> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-cin-'));
  try {
    let workingPath = path.join(tmpDir, `${params.id}_raw.mp4`);
    await fs.promises.writeFile(workingPath, params.rawVideoBuffer);

    // Optional crop for 1:1 / 4:3 / 21:9 if newly generated
    if (
      (params.operationType === 'generate' || params.operationType === 'i2v' || params.operationType === 'storyboard') &&
      (params.config.aspectRatio === '1:1' || params.config.aspectRatio === '4:3' || params.config.aspectRatio === '21:9')
    ) {
      const croppedPath = path.join(tmpDir, `${params.id}_crop.mp4`);
      const cropped = await applyAspectCropFfmpeg(workingPath, croppedPath, params.config.aspectRatio).catch(() => false);
      if (cropped && fs.existsSync(croppedPath)) {
        workingPath = croppedPath;
      }
    }

    const finalBuf = await fs.promises.readFile(workingPath);
    const probe = await probeVideoFile(workingPath);

    const posterTmpPath = path.join(tmpDir, `${params.id}_poster.jpg`);
    const hasPoster = await extractPosterFrame(workingPath, posterTmpPath, Math.min(0.4, probe.duration / 2));

    const videoAsset = await saveTenantCinemaAssetBuffer(params.tenantId, params.id, 'mp4', finalBuf);
    let posterUrl = '';
    let posterFilename: string | undefined;
    if (hasPoster) {
      const posterBuf = await fs.promises.readFile(posterTmpPath);
      const posterAsset = await saveTenantCinemaAssetBuffer(params.tenantId, `${params.id}_poster`, 'jpg', posterBuf);
      posterUrl = posterAsset.url;
      posterFilename = posterAsset.filename;
    }

    return {
      id: params.id,
      parentId: params.parentId ?? null,
      rootId: params.rootId ?? params.id,
      version: params.version ?? 1,
      operationType: params.operationType,
      prompt: params.prompt,
      compiledPrompt: params.compiledPrompt,
      enhancedFrom: params.enhancedFrom,
      editInstruction: params.editInstruction,
      negativePrompt: params.config.negativePrompt,
      model: params.config.model,
      engineModelUsed: params.engineModelUsed || 'gemini-omni-1.2-flash',
      interactionId: params.interactionId ?? null,
      cameraMotion: params.config.camera.trajectory,
      motionStrength: params.config.camera.motionStrength,
      duration: probe.duration || params.config.duration,
      fps: probe.fps || params.config.fps,
      aspectRatio: params.config.aspectRatio,
      dimensions: `${probe.width}x${probe.height}`,
      resolution: params.config.resolution,
      width: probe.width,
      height: probe.height,
      fileSizeBytes: probe.fileSizeBytes,
      hasAudio: probe.hasAudio,
      videoUrl: videoAsset.url,
      posterUrl,
      sourceVideoUrl: params.sourceVideoUrl,
      assetFilename: videoAsset.filename,
      posterFilename,
      mimeType: 'video/mp4',
      mode: params.config.mode,
      referenceImage: params.referenceImage ?? null,
      referenceImages: params.referenceImages,
      endKeyframeImage: params.endKeyframeImage ?? null,
      seed: params.config.seed,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      upscaled: Boolean(params.upscaled || params.config.resolution === '4k'),
      extended: Boolean(params.extended),
      interpolated: Boolean(params.interpolated || probe.fps >= 58),
      audioSynced: Boolean(params.audioSynced || probe.hasAudio),
      trimmed: Boolean(params.trimmed),
      trimRange: params.trimRange,
      aiNotes: params.aiNotes,
      configSnapshot: params.config,
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
