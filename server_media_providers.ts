import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Modality, type GoogleGenAI } from '@google/genai';
import type { ByokKeyMap } from './server_tenant_store.ts';
import type { PlanId } from './src/lib/pricingCatalog.ts';

const execFileAsync = promisify(execFile);

export function isBillingOrQuotaFailure(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  const status = Number((err as any)?.status || (err as any)?.code || 0);
  if (status === 402 || status === 429) return true;
  return (
    msg.includes('402') ||
    msg.includes('prepayment credits') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('payment required') ||
    msg.includes('insufficient_quota') ||
    msg.includes('credits are depleted')
  );
}

export interface MediaEnvKeys {
  openRouterApiKey?: string;
  falApiKey?: string;
  hfApiToken?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  groqApiKey?: string;
  openAiApiKey?: string;
}

export function getServerMediaEnvKeys(): MediaEnvKeys {
  return {
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    falApiKey: process.env.FAL_KEY || process.env.FAL_API_KEY || '',
    hfApiToken: process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '',
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    openAiApiKey: process.env.OPENAI_API_KEY || '',
  };
}

export function resolveEffectiveMediaKey(
  byokVal: string | undefined,
  envVal: string | undefined
): { key: string; usedByok: boolean } {
  const cleanByok = String(byokVal || '').trim();
  if (cleanByok) return { key: cleanByok, usedByok: true };
  return { key: String(envVal || '').trim(), usedByok: false };
}

// =========================================================================
// 1. OpenRouter Text & Free Coding Models Gateway
// =========================================================================
export async function callOpenRouterChat(params: {
  apiKey: string;
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const cleanKey = String(params.apiKey || '').trim();
  if (!cleanKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const model =
    params.model ||
    process.env.OPENROUTER_FREE_MODEL ||
    'qwen/qwen3-coder:free';

  const formatted = [
    ...(params.systemPrompt ? [{ role: 'system', content: params.systemPrompt }] : []),
    ...params.messages.map((m) => ({
      role: m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'assistant',
      content: m.content,
    })),
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleanKey}`,
      'HTTP-Referer': process.env.PUBLIC_APP_URL || 'https://raoneai.web.app',
      'X-Title': 'RaOne AI Studio',
    },
    body: JSON.stringify({
      model,
      messages: formatted,
      temperature: params.temperature ?? 0.65,
      max_tokens: params.maxTokens ?? 4096,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`OpenRouter error (${res.status}): ${errTxt.slice(0, 220)}`);
  }

  const json: any = await res.json();
  const text = String(json?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('OpenRouter returned an empty response.');
  return { text, modelUsed: json?.model || model };
}

// =========================================================================
// 2. Multi-Provider Image Synthesis (Gemini -> fal.ai -> Cloudflare -> HF -> Pollinations -> Local FFmpeg)
// =========================================================================
function aspectRatioToWidthHeight(aspectRatio: string, resolution: '1K' | '2K' | '4K'): {
  width: number;
  height: number;
  falSize: string;
} {
  const base = resolution === '4K' ? 1408 : resolution === '2K' ? 1280 : 1024;
  switch (aspectRatio) {
    case '1:1':
      return { width: base, height: base, falSize: 'square_hd' };
    case '9:16':
      return { width: Math.round((base * 9) / 16 / 8) * 8, height: base, falSize: 'portrait_16_9' };
    case '3:4':
      return { width: Math.round((base * 3) / 4 / 8) * 8, height: base, falSize: 'portrait_4_3' };
    case '4:3':
      return { width: base, height: Math.round((base * 3) / 4 / 8) * 8, falSize: 'landscape_4_3' };
    case '21:9':
      return { width: base, height: Math.round((base * 9) / 21 / 8) * 8, falSize: 'landscape_16_9' };
    case '16:9':
    default:
      return { width: base, height: Math.round((base * 9) / 16 / 8) * 8, falSize: 'landscape_16_9' };
  }
}

export async function renderFallbackVisualCardPng(
  prompt: string,
  width = 1024,
  height = 576
): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-vis-fb-'));
  try {
    const outPng = path.join(tmpDir, 'card.png');
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `color=c=#111827:s=${width}x${height}:d=1`,
        '-vf',
        `geq=r='clip(18+40*X/W+25*sin(Y/45),0,255)':g='clip(24+30*Y/H,0,255)':b='clip(58+120*X/W+35*cos(Y/60),0,255)'`,
        '-frames:v',
        '1',
        outPng,
      ],
      { timeout: 15000 }
    );
    return await fs.promises.readFile(outPng);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function resolveImageProviderOrder(
  plan?: PlanId,
  byok?: ByokKeyMap
): Array<'gemini' | 'fal' | 'cloudflare' | 'huggingface' | 'pollinations' | 'procedural'> {
  const userHasPaidImageByok = Boolean(byok?.geminiApiKey || byok?.falApiKey);
  if (plan === 'free' && !userHasPaidImageByok) {
    return ['cloudflare', 'huggingface', 'pollinations', 'procedural'];
  }
  return ['gemini', 'fal', 'cloudflare', 'huggingface', 'pollinations', 'procedural'];
}

export async function generateMultiProviderImage(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  resolution: '1K' | '2K' | '4K';
  seed?: number;
  plan?: PlanId;
  byok?: ByokKeyMap;
  geminiAttempt?: () => Promise<{ base64Data: string; mimeType: string; aiNotes?: string; engineModelUsed: string }>;
}): Promise<{
  base64Data: string;
  mimeType: string;
  aiNotes?: string;
  engineModelUsed: string;
  providerUsed: string;
  usedByok: boolean;
}> {
  const envKeys = getServerMediaEnvKeys();
  const { width, height, falSize } = aspectRatioToWidthHeight(params.aspectRatio, params.resolution);
  const errors: string[] = [];
  const providerOrder = resolveImageProviderOrder(params.plan, params.byok);

  // 1. Gemini (only for Plus/Ultimate or user Gemini BYOK — never waste server credits on Free tier)
  if (providerOrder.includes('gemini') && params.geminiAttempt) {
    try {
      const gem = await params.geminiAttempt();
      return {
        ...gem,
        providerUsed: 'gemini',
        usedByok: Boolean(params.byok?.geminiApiKey),
      };
    } catch (err: any) {
      errors.push(`Gemini: ${err?.message || 'failed'}`);
      if (!isBillingOrQuotaFailure(err)) {
        // Still fall back cleanly so users always get resilient rendering
        console.warn('Gemini image fallback triggered:', err?.message || err);
      }
    }
  }

  // 2. fal.ai (only for Plus/Ultimate or user fal.ai BYOK — Free users use Cloudflare/HF/Pollinations at $0)
  const fal = resolveEffectiveMediaKey(params.byok?.falApiKey, envKeys.falApiKey);
  if (providerOrder.includes('fal') && fal.key) {
    try {
      const falModel =
        params.resolution === '1K' || params.plan === 'free'
          ? 'fal-ai/flux/schnell'
          : 'fal-ai/flux-pro/v1.1';
      const falRes = await fetch(`https://fal.run/${falModel}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${fal.key}`,
        },
        body: JSON.stringify({
          prompt: params.prompt,
          image_size: falSize,
          num_images: 1,
          ...(typeof params.seed === 'number' ? { seed: Math.abs(Math.floor(params.seed)) } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (falRes.ok) {
        const json: any = await falRes.json();
        const imgUrl = json?.images?.[0]?.url;
        if (imgUrl) {
          const imgDownload = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
          if (imgDownload.ok) {
            const arrBuf = await imgDownload.arrayBuffer();
            const mime = imgDownload.headers.get('content-type') || 'image/jpeg';
            return {
              base64Data: Buffer.from(arrBuf).toString('base64'),
              mimeType: mime,
              engineModelUsed: falModel,
              providerUsed: 'fal.ai',
              usedByok: fal.usedByok,
              aiNotes: `Synthesized with ${falModel} via fal.ai`,
            };
          }
        }
      } else {
        errors.push(`fal.ai (${falRes.status})`);
      }
    } catch (err: any) {
      errors.push(`fal.ai: ${err?.message || 'failed'}`);
    }
  }

  // 3. Cloudflare Workers AI (Free 10,000 Neurons/day: @cf/black-forest-labs/flux-1-schnell)
  const cfAcc = String(params.byok?.cloudflareAccountId || envKeys.cloudflareAccountId || '').trim();
  const cfTok = resolveEffectiveMediaKey(params.byok?.cloudflareApiToken, envKeys.cloudflareApiToken);
  if (cfAcc && cfTok.key) {
    try {
      const cfModel = '@cf/black-forest-labs/flux-1-schnell';
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAcc)}/ai/run/${cfModel}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfTok.key}`,
          },
          body: JSON.stringify({
            prompt: params.prompt.slice(0, 2000),
            steps: 4,
          }),
          signal: AbortSignal.timeout(45000),
        }
      );
      if (cfRes.ok) {
        const json: any = await cfRes.json();
        const b64 = json?.result?.image;
        if (typeof b64 === 'string' && b64.length > 100) {
          return {
            base64Data: b64,
            mimeType: 'image/png',
            engineModelUsed: 'cf-flux-1-schnell',
            providerUsed: 'cloudflare',
            usedByok: cfTok.usedByok,
            aiNotes: 'Synthesized with Cloudflare Workers AI (FLUX.1-schnell)',
          };
        }
      } else {
        errors.push(`Cloudflare (${cfRes.status})`);
      }
    } catch (err: any) {
      errors.push(`Cloudflare: ${err?.message || 'failed'}`);
    }
  }

  // 4. Hugging Face Inference API (Free tier FLUX.1-schnell)
  const hf = resolveEffectiveMediaKey(params.byok?.hfApiToken, envKeys.hfApiToken);
  if (hf.key) {
    try {
      const hfModel = 'black-forest-labs/FLUX.1-schnell';
      const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${hfModel}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hf.key}`,
        },
        body: JSON.stringify({
          inputs: params.prompt.slice(0, 1500),
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (hfRes.ok) {
        const ctype = hfRes.headers.get('content-type') || 'image/jpeg';
        if (ctype.startsWith('image/')) {
          const buf = Buffer.from(await hfRes.arrayBuffer());
          if (buf.length > 500) {
            return {
              base64Data: buf.toString('base64'),
              mimeType: ctype,
              engineModelUsed: hfModel,
              providerUsed: 'huggingface',
              usedByok: hf.usedByok,
              aiNotes: 'Synthesized with Hugging Face FLUX.1-schnell',
            };
          }
        }
      } else {
        errors.push(`HuggingFace (${hfRes.status})`);
      }
    } catch (err: any) {
      errors.push(`HuggingFace: ${err?.message || 'failed'}`);
    }
  }

  // 5. Pollinations.ai (100% Free, Zero-Key Flux Image Endpoint)
  try {
    const cleanPrompt = encodeURIComponent(params.prompt.slice(0, 900));
    const seedParam = typeof params.seed === 'number' ? Math.abs(Math.floor(params.seed)) : Math.floor(Math.random() * 999999);
    const pollUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seedParam}&model=flux&nologo=true`;
    const pollRes = await fetch(pollUrl, { signal: AbortSignal.timeout(45000) });
    if (pollRes.ok) {
      const ctype = pollRes.headers.get('content-type') || 'image/jpeg';
      if (ctype.startsWith('image/')) {
        const buf = Buffer.from(await pollRes.arrayBuffer());
        if (buf.length > 1000) {
          return {
            base64Data: buf.toString('base64'),
            mimeType: ctype,
            engineModelUsed: 'pollinations-flux-free',
            providerUsed: 'pollinations',
            usedByok: false,
            aiNotes: 'Synthesized with RaOne Free Flux Engine (Pollinations)',
          };
        }
      }
    } else {
      errors.push(`Pollinations (${pollRes.status})`);
    }
  } catch (err: any) {
    errors.push(`Pollinations: ${err?.message || 'failed'}`);
  }

  // 6. Deterministic local FFmpeg canvas render so the UI never deadlocks offline
  const fbPng = await renderFallbackVisualCardPng(params.prompt, Math.min(width, 1024), Math.min(height, 768));
  return {
    base64Data: fbPng.toString('base64'),
    mimeType: 'image/png',
    engineModelUsed: 'raone-procedural-canvas',
    providerUsed: 'procedural',
    usedByok: false,
    aiNotes: `Offline/sandbox fallback render (${errors.slice(0, 2).join('; ') || 'no remote provider reachable'}).`,
  };
}

// =========================================================================
// 3. Multi-Provider Music Engine (Lyria -> fal.ai -> HF MusicGen -> FFmpeg Studio Synth)
// =========================================================================
function rootNoteToFreq(keySig: string): number {
  const note = String(keySig || 'C').trim().split(/\s+/)[0].toUpperCase();
  const map: Record<string, number> = {
    C: 130.81,
    'C#': 138.59,
    DB: 138.59,
    D: 146.83,
    'D#': 155.56,
    EB: 155.56,
    E: 164.81,
    F: 174.61,
    'F#': 185.0,
    GB: 185.0,
    G: 196.0,
    'G#': 207.65,
    AB: 207.65,
    A: 220.0,
    'A#': 233.08,
    BB: 233.08,
    B: 246.94,
  };
  return map[note] || 146.83;
}

export async function synthesizeProceduralMusicFfmpeg(opts: {
  bpm: number;
  keySignature: string;
  durationSec?: number;
}): Promise<Buffer> {
  const duration = Math.min(30, Math.max(8, Math.round(opts.durationSec || 16)));
  const bpm = Math.min(180, Math.max(60, Math.round(opts.bpm || 110)));
  const beatHz = (bpm / 60).toFixed(3);
  const f1 = rootNoteToFreq(opts.keySignature);
  const f2 = f1 * 1.25; // major/warm harmonic third
  const f3 = f1 * 1.5;  // fifth
  const f4 = f1 * 2.0;  // octave shimmer

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-synth-mus-'));
  try {
    const outMp3 = path.join(tmpDir, 'synth_track.mp3');
    // Multi-harmonic ambient synth pad + rhythmic pulse envelope rendered natively by FFmpeg
    const expr = [
      `0.28*sin(2*PI*${f1.toFixed(2)}*t)*exp(-0.4*(t*${beatHz}-floor(t*${beatHz})))`,
      `0.18*sin(2*PI*${f2.toFixed(2)}*t)*(0.6+0.4*sin(2*PI*0.25*t))`,
      `0.16*sin(2*PI*${f3.toFixed(2)}*t)*(0.5+0.5*cos(2*PI*0.5*t))`,
      `0.10*sin(2*PI*${f4.toFixed(2)}*t)*exp(-2.2*(t*${beatHz}-floor(t*${beatHz})))`,
    ].join('+');

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `aevalsrc=${expr}:s=44100:d=${duration}`,
        '-af',
        `afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(1, duration - 1.5)}:d=1.5,aecho=0.8:0.88:60:0.35,loudnorm=I=-14:TP=-1.5`,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '192k',
        outMp3,
      ],
      { timeout: 30000 }
    );
    return await fs.promises.readFile(outMp3);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function resolveMusicProviderOrder(
  plan?: PlanId,
  byok?: ByokKeyMap
): Array<'gemini' | 'fal' | 'huggingface' | 'ffmpeg_synth'> {
  const userHasPaidMusicByok = Boolean(byok?.geminiApiKey || byok?.falApiKey);
  if (plan === 'free' && !userHasPaidMusicByok) {
    return ['huggingface', 'ffmpeg_synth'];
  }
  return ['gemini', 'fal', 'huggingface', 'ffmpeg_synth'];
}

export async function generateMultiProviderMusic(params: {
  compiledPrompt: string;
  bpm: number;
  keySignature: string;
  durationSec?: number;
  plan?: PlanId;
  byok?: ByokKeyMap;
  geminiAttempt?: () => Promise<{ buffer: Buffer; mimeType: string; lyrics?: string; modelUsed: string }>;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  lyrics?: string;
  modelUsed: string;
  providerUsed: string;
  usedByok: boolean;
  isProceduralFallback: boolean;
}> {
  const envKeys = getServerMediaEnvKeys();
  const providerOrder = resolveMusicProviderOrder(params.plan, params.byok);

  // 1. Gemini Lyria (Plus/Ultimate or user Gemini BYOK)
  if (providerOrder.includes('gemini') && params.geminiAttempt) {
    try {
      const lyria = await params.geminiAttempt();
      return {
        ...lyria,
        providerUsed: 'gemini',
        usedByok: Boolean(params.byok?.geminiApiKey),
        isProceduralFallback: false,
      };
    } catch (err: any) {
      console.warn('Gemini Lyria fallback triggered:', err?.message || err);
    }
  }

  // 2. fal.ai Music (fal-ai/ace-step — Plus/Ultimate or user fal.ai BYOK)
  const fal = resolveEffectiveMediaKey(params.byok?.falApiKey, envKeys.falApiKey);
  if (providerOrder.includes('fal') && fal.key) {
    try {
      const falRes = await fetch('https://fal.run/fal-ai/ace-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${fal.key}`,
        },
        body: JSON.stringify({
          prompt: params.compiledPrompt.slice(0, 600),
          duration: Math.min(60, Math.max(10, params.durationSec || 24)),
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (falRes.ok) {
        const json: any = await falRes.json();
        const audioUrl = json?.audio?.url || json?.audio_file?.url;
        if (audioUrl) {
          const dl = await fetch(audioUrl, { signal: AbortSignal.timeout(30000) });
          if (dl.ok) {
            const buf = Buffer.from(await dl.arrayBuffer());
            if (buf.length > 1000) {
              return {
                buffer: buf,
                mimeType: dl.headers.get('content-type') || 'audio/wav',
                modelUsed: 'fal-ai/ace-step',
                providerUsed: 'fal.ai',
                usedByok: fal.usedByok,
                isProceduralFallback: false,
              };
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('fal.ai music fallback triggered:', err?.message || err);
    }
  }

  // 3. Hugging Face Inference (Free tier facebook/musicgen-small)
  const hf = resolveEffectiveMediaKey(params.byok?.hfApiToken, envKeys.hfApiToken);
  if (hf.key) {
    try {
      const hfRes = await fetch('https://router.huggingface.co/hf-inference/models/facebook/musicgen-small', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hf.key}`,
        },
        body: JSON.stringify({ inputs: params.compiledPrompt.slice(0, 500) }),
        signal: AbortSignal.timeout(60000),
      });
      if (hfRes.ok) {
        const buf = Buffer.from(await hfRes.arrayBuffer());
        if (buf.length > 2000) {
          return {
            buffer: buf,
            mimeType: hfRes.headers.get('content-type') || 'audio/flac',
            modelUsed: 'facebook/musicgen-small',
            providerUsed: 'huggingface',
            usedByok: hf.usedByok,
            isProceduralFallback: false,
          };
        }
      }
    } catch (err: any) {
      console.warn('HuggingFace MusicGen fallback triggered:', err?.message || err);
    }
  }

  // 4. Zero-Cost FFmpeg Multi-Layer Studio Synth
  const synthBuf = await synthesizeProceduralMusicFfmpeg({
    bpm: params.bpm,
    keySignature: params.keySignature,
    durationSec: params.durationSec || 16,
  });
  return {
    buffer: synthBuf,
    mimeType: 'audio/mpeg',
    modelUsed: 'raone-studio-synth-dsp',
    providerUsed: 'procedural',
    usedByok: false,
    isProceduralFallback: true,
  };
}

// =========================================================================
// 4. Multi-Provider Video Engine (Gemini Omni -> fal.ai LTX -> HF Wan2.1 -> AI Keyframe Motion MP4)
// =========================================================================
export async function synthesizeCinemaMotionVideoFfmpeg(opts: {
  prompt: string;
  aspectRatio: string;
  durationSec: number;
  cameraMotion?: string;
  byok?: ByokKeyMap;
}): Promise<{ buffer: Buffer; keyframeProvider: string }> {
  const kf = await generateMultiProviderImage({
    prompt: `Cinematic film still, ultra detailed, ${opts.prompt}`,
    aspectRatio: opts.aspectRatio,
    resolution: '1K',
    plan: 'free',
    byok: opts.byok,
  });

  const dur = Math.min(8, Math.max(3, Math.round(opts.durationSec || 4)));
  const fps = 24;
  const totalFrames = dur * fps;
  const dims =
    opts.aspectRatio === '9:16'
      ? '720x1280'
      : opts.aspectRatio === '1:1'
      ? '720x720'
      : '1280x720';

  const motion = String(opts.cameraMotion || '').toLowerCase();
  let zoomExpr = `min(zoom+0.0016,1.25)`;
  let xExpr = `iw/2-(iw/zoom/2)`;
  let yExpr = `ih/2-(ih/zoom/2)`;

  if (motion.includes('pan_left') || motion.includes('left')) {
    zoomExpr = '1.18';
    xExpr = `(iw-iw/zoom)*(1-on/${totalFrames})`;
  } else if (motion.includes('pan_right') || motion.includes('right')) {
    zoomExpr = '1.18';
    xExpr = `(iw-iw/zoom)*(on/${totalFrames})`;
  } else if (motion.includes('zoom_out') || motion.includes('pull')) {
    zoomExpr = `max(1.25-0.0018*on,1.0)`;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-kf-vid-'));
  try {
    const imgPath = path.join(tmpDir, 'keyframe.png');
    const mp4Path = path.join(tmpDir, 'motion.mp4');
    await fs.promises.writeFile(imgPath, Buffer.from(kf.base64Data, 'base64'));

    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-loop',
        '1',
        '-i',
        imgPath,
        '-vf',
        `scale=1600:-2,zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${dims}:fps=${fps},format=yuv420p`,
        '-t',
        String(dur),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        mp4Path,
      ],
      { timeout: 60000 }
    );

    return {
      buffer: await fs.promises.readFile(mp4Path),
      keyframeProvider: kf.providerUsed,
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function generateMultiProviderVideo(params: {
  compiledPrompt: string;
  rawPrompt: string;
  aspectRatio: string;
  durationSec: number;
  resolution: '360p' | '720p' | '1080p' | '4k';
  cameraMotion?: string;
  plan?: PlanId;
  byok?: ByokKeyMap;
  geminiAttempt?: () => Promise<{ buffer: Buffer; mimeType: string; interactionId: string | null }>;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  interactionId: string | null;
  engineModelUsed: string;
  providerUsed: string;
  usedByok: boolean;
  isMotionPreview: boolean;
}> {
  const envKeys = getServerMediaEnvKeys();
  const allowPaidNeuralVideo =
    params.plan === 'plus' ||
    params.plan === 'ultimate' ||
    Boolean(params.byok?.geminiApiKey || params.byok?.falApiKey);

  // 1. Gemini Omni (only for paid plans or BYOK, skipped cleanly on 402/quota)
  if (allowPaidNeuralVideo && params.geminiAttempt) {
    try {
      const gem = await params.geminiAttempt();
      return {
        ...gem,
        engineModelUsed: 'gemini-omni-1.2-flash',
        providerUsed: 'gemini',
        usedByok: Boolean(params.byok?.geminiApiKey),
        isMotionPreview: false,
      };
    } catch (err: any) {
      console.warn('Gemini Omni video fallback triggered:', err?.message || err);
    }
  }

  // 2. fal.ai LTX-Video (low-cost neural video for paid plans / BYOK)
  const fal = resolveEffectiveMediaKey(params.byok?.falApiKey, envKeys.falApiKey);
  if (allowPaidNeuralVideo && fal.key) {
    try {
      const falRes = await fetch('https://fal.run/fal-ai/ltx-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${fal.key}`,
        },
        body: JSON.stringify({
          prompt: params.compiledPrompt.slice(0, 700),
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (falRes.ok) {
        const json: any = await falRes.json();
        const vidUrl = json?.video?.url;
        if (vidUrl) {
          const dl = await fetch(vidUrl, { signal: AbortSignal.timeout(60000) });
          if (dl.ok) {
            const buf = Buffer.from(await dl.arrayBuffer());
            if (buf.length > 5000) {
              return {
                buffer: buf,
                mimeType: 'video/mp4',
                interactionId: null,
                engineModelUsed: 'fal-ai/ltx-video',
                providerUsed: 'fal.ai',
                usedByok: fal.usedByok,
                isMotionPreview: false,
              };
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('fal.ai LTX-Video fallback triggered:', err?.message || err);
    }
  }

  // 3. Free AI-Keyframe-to-Motion Cinema Preview (0 GPU Cost via Free Vision Image + FFmpeg Zoompan)
  const kfVid = await synthesizeCinemaMotionVideoFfmpeg({
    prompt: params.rawPrompt,
    aspectRatio: params.aspectRatio,
    durationSec: params.durationSec,
    cameraMotion: params.cameraMotion,
    byok: params.byok,
  });

  return {
    buffer: kfVid.buffer,
    mimeType: 'video/mp4',
    interactionId: null,
    engineModelUsed: `raone-motion-preview (${kfVid.keyframeProvider})`,
    providerUsed: kfVid.keyframeProvider,
    usedByok: false,
    isMotionPreview: true,
  };
}

// =========================================================================
// 5. Multi-Provider Speech / TTS (Gemini TTS -> Groq PlayAI -> OpenAI -> HF -> Synth Fallback)
// =========================================================================
export async function generateMultiProviderSpeech(params: {
  text: string;
  voiceName?: string;
  plan?: PlanId;
  geminiClient?: GoogleGenAI | null;
  byok?: ByokKeyMap;
  fallbackGroqKey?: string;
  fallbackOpenAiKey?: string;
}): Promise<{ buffer: Buffer; mimeType: string; providerUsed: string }> {
  const cleanText = String(params.text || '').trim().slice(0, 3000);
  const envKeys = getServerMediaEnvKeys();
  const preferFreeSpeech = params.plan === 'free' && !params.byok?.geminiApiKey && !params.byok?.openAiApiKey;

  const tryGroqTts = async () => {
    const groqKey = String(params.byok?.groqApiKey || params.fallbackGroqKey || envKeys.groqApiKey || '').trim();
    if (!groqKey) return null;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'playai-tts',
          input: cleanText,
          voice: 'Fritz-PlayAI',
          response_format: 'wav',
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          return { buffer: buf, mimeType: 'audio/wav', providerUsed: 'groq-playai-tts' };
        }
      }
    } catch (err: any) {
      console.warn('Groq TTS fallback triggered:', err?.message || err);
    }
    return null;
  };

  if (preferFreeSpeech) {
    const freeGroq = await tryGroqTts();
    if (freeGroq) return freeGroq;
  }

  // Gemini TTS (skipped on Free tier unless Gemini BYOK, or attempted first on Plus/Ultimate)
  if (!preferFreeSpeech && params.geminiClient) {
    try {
      const ttsRes = await params.geminiClient.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: cleanText } as any],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: params.voiceName || 'Kore' },
            },
          },
        },
      });
      const b64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        return {
          buffer: Buffer.from(b64, 'base64'),
          mimeType: 'audio/wav',
          providerUsed: 'gemini-tts',
        };
      }
    } catch (err: any) {
      console.warn('Gemini TTS fallback triggered:', err?.message || err);
    }
  }

  // Groq PlayAI TTS (for Plus/Ultimate fallback when Gemini TTS fails)
  if (!preferFreeSpeech) {
    const paidFallbackGroq = await tryGroqTts();
    if (paidFallbackGroq) return paidFallbackGroq;
  }

  // OpenAI TTS (Plus/Ultimate or OpenAI BYOK only)
  const oaKey = String(params.byok?.openAiApiKey || params.fallbackOpenAiKey || envKeys.openAiApiKey || '').trim();
  if (!preferFreeSpeech && oaKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${oaKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: cleanText,
          voice: 'onyx',
          response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          return { buffer: buf, mimeType: 'audio/mpeg', providerUsed: 'openai-tts' };
        }
      }
    } catch (err: any) {
      console.warn('OpenAI TTS fallback triggered:', err?.message || err);
    }
  }

  // 4. Hugging Face MMS TTS
  const hf = resolveEffectiveMediaKey(params.byok?.hfApiToken, envKeys.hfApiToken);
  if (hf.key) {
    try {
      const res = await fetch('https://router.huggingface.co/hf-inference/models/facebook/mms-tts-eng', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hf.key}`,
        },
        body: JSON.stringify({ inputs: cleanText.slice(0, 600) }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          return { buffer: buf, mimeType: 'audio/flac', providerUsed: 'huggingface-tts' };
        }
      }
    } catch {
      // fall through
    }
  }

  // 5. Clean briefing chime WAV fallback (ensures transcript + playable briefing audio never fails)
  const chimeBuf = await synthesizeProceduralMusicFfmpeg({
    bpm: 96,
    keySignature: 'C',
    durationSec: 8,
  });
  return {
    buffer: chimeBuf,
    mimeType: 'audio/mpeg',
    providerUsed: 'procedural-audio-brief',
  };
}
