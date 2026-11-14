import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { callGroqChat } from './server_groq_service.ts';
import { getActiveLocalEndpointConfig, callLocalLlmChat } from './server_local_llm.ts';
import { SYSTEM_PROMPT, appendRuntimeMetadata } from './src/lib/systemPrompts.ts';
import type { ByokKeyMap } from './server_tenant_store.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_ROOT = path.join(__dirname, 'data', 'tenants');

export type VisionResolutionTier = '1K' | '2K' | '4K';

export type VisionOperationType =
  | 'generate'
  | 'edit'
  | 'inpaint'
  | 'background_swap'
  | 'object_remove'
  | 'restyle'
  | 'outpaint'
  | 'upscale'
  | 'variation';

export type VisionEnhancerMode =
  | 'auto'
  | 'cinematic'
  | 'product'
  | 'anime'
  | 'concept3d'
  | 'minimal';

export interface VisionCameraSpec {
  shotType?: string;
  lens?: string;
  aperture?: string;
  lighting?: string;
  atmosphere?: string;
  colorGrade?: string;
  composition?: string;
}

export interface VisionCompileInput {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  style?: string;
  aspectRatio?: string;
  resolution?: VisionResolutionTier;
  cfgScale?: number;
  steps?: number;
  alchemy?: boolean;
  photoReal?: boolean;
  promptMagic?: boolean;
  cameraSpec?: VisionCameraSpec;
}

export interface VisionImageRecord {
  id: string;
  parentId?: string | null;
  rootId?: string | null;
  version: number;
  operationType: VisionOperationType;
  prompt: string;
  compiledPrompt: string;
  enhancedFrom?: string;
  negativePrompt: string;
  model: string;
  engineModelUsed: string;
  style: string;
  aspectRatio: string;
  dimensions: string;
  resolution: VisionResolutionTier;
  cfgScale: number;
  steps: number;
  seed: number;
  imageUrl: string;
  sourceImageUrl?: string;
  assetFilename?: string;
  mimeType: string;
  createdAt: string;
  isFavorite: boolean;
  alchemy: boolean;
  photoReal: boolean;
  promptMagic: boolean;
  googleSearchGrounding?: boolean;
  upscaled: boolean;
  aiNotes?: string;
  cameraSpec?: VisionCameraSpec;
  publishMeta?: {
    isPublished: boolean;
    shareId?: string;
    shareUrl?: string;
    publishedAt?: string;
  };
}

export interface VisionPublishedSnapshot {
  shareId: string;
  tenantId: string;
  imageId: string;
  title: string;
  prompt: string;
  compiledPrompt: string;
  negativePrompt: string;
  model: string;
  style: string;
  aspectRatio: string;
  dimensions: string;
  resolution: VisionResolutionTier;
  seed: number;
  cameraSpec?: VisionCameraSpec;
  imageDataUrl: string;
  publishedAt: string;
}

const SUPPORTED_FLASH_IMAGE_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
const SUPPORTED_ULTRA_IMAGE_RATIOS = new Set([
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '1:4',
  '1:8',
  '4:1',
  '8:1',
]);

export function sanitizeTenantIdForVision(tenantId: string): string {
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'guest_workspace';
}

export function getTenantVisionAssetsDir(tenantId: string): string {
  const dir = path.join(DATA_ROOT, sanitizeTenantIdForVision(tenantId), 'vision_assets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function isValidVisionAssetFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._-]{4,140}\.(png|jpe?g|webp)$/i.test(filename);
}

export function resolveTenantVisionAssetPath(tenantId: string, filename: string): string | null {
  if (!isValidVisionAssetFilename(filename)) return null;
  const dir = getTenantVisionAssetsDir(tenantId);
  const resolved = path.resolve(dir, path.basename(filename));
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    return null;
  }
  return resolved;
}

export async function saveTenantVisionAsset(
  tenantId: string,
  imageId: string,
  base64Data: string,
  mimeType = 'image/png'
): Promise<{ assetFilename: string; imageUrl: string; filePath: string }> {
  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg')
    ? 'jpg'
    : mimeType.includes('webp')
    ? 'webp'
    : 'png';
  const cleanId = imageId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const assetFilename = `${cleanId}.${ext}`;
  const dir = getTenantVisionAssetsDir(tenantId);
  const filePath = path.join(dir, assetFilename);
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(filePath, buffer);
  return {
    assetFilename,
    imageUrl: `/api/vision/assets/${assetFilename}`,
    filePath,
  };
}

export function parseDataUrlImage(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(),
    base64: match[2],
  };
}

export async function resolveImageInputToInlinePart(
  tenantId: string,
  imageInput: string
): Promise<{ mimeType: string; data: string } | null> {
  const trimmed = String(imageInput || '').trim();
  if (!trimmed) return null;

  // 1. Direct data URL
  const parsedData = parseDataUrlImage(trimmed);
  if (parsedData) {
    return { mimeType: parsedData.mimeType, data: parsedData.base64 };
  }

  // 2. Local tenant asset URL (/api/vision/assets/<filename>)
  const assetMatch = trimmed.match(/^\/api\/vision\/assets\/([a-zA-Z0-9._-]+)$/);
  if (assetMatch) {
    const filePath = resolveTenantVisionAssetPath(tenantId, assetMatch[1]);
    if (filePath && fs.existsSync(filePath)) {
      const buf = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      return { mimeType, data: buf.toString('base64') };
    }
  }

  return null;
}

export function normalizeAspectRatioForGemini(aspectRatio: string, engineModel: string): string {
  const raw = String(aspectRatio || '1:1').trim();
  // Map cinema 21:9 smoothly to nearest supported ultra-wide ratio depending on model
  if (raw === '21:9') {
    return engineModel === 'gemini-nano-banana-2.1' ? '4:1' : '16:9';
  }
  const allowed =
    engineModel === 'gemini-nano-banana-2.1' || engineModel === 'gemini-3-pro-image'
      ? SUPPORTED_ULTRA_IMAGE_RATIOS
      : SUPPORTED_FLASH_IMAGE_RATIOS;

  if (allowed.has(raw)) return raw;
  return '16:9';
}

export function computeVisionDimensions(aspectRatio: string, resolution: VisionResolutionTier): string {
  const mult = resolution === '4K' ? 2 : resolution === '2K' ? 1.5 : 1;
  const baseMap: Record<string, [number, number]> = {
    '1:1': [1024, 1024],
    '16:9': [1344, 768],
    '9:16': [768, 1344],
    '4:3': [1152, 864],
    '3:4': [864, 1152],
    '21:9': [1536, 640],
    '4:1': [2048, 512],
    '8:1': [2560, 320],
    '1:4': [512, 2048],
    '1:8': [320, 2560],
  };
  const [w, h] = baseMap[aspectRatio] || [1344, 768];
  return `${Math.round(w * mult)}x${Math.round(h * mult)}`;
}

export function selectGeminiImageEngine(opts: {
  modelProfile?: string;
  resolution?: VisionResolutionTier;
  aspectRatio?: string;
  googleSearchGrounding?: boolean;
  isEditOrUpscale?: boolean;
}): 'gemini-3.1-flash-lite-image' | 'gemini-nano-banana-2.1' {
  const profile = String(opts.modelProfile || '').toLowerCase();
  const res = opts.resolution || '1K';
  const ar = String(opts.aspectRatio || '16:9');
  const isExtendedRatio = ['1:4', '1:8', '4:1', '8:1', '21:9'].includes(ar);

  if (profile.includes('flash lite') || profile.includes('fast')) {
    if (res === '1K' && !isExtendedRatio && !opts.googleSearchGrounding && !opts.isEditOrUpscale) {
      return 'gemini-3.1-flash-lite-image';
    }
  }

  if (
    res === '2K' ||
    res === '4K' ||
    isExtendedRatio ||
    opts.googleSearchGrounding ||
    opts.isEditOrUpscale ||
    profile.includes('ultra') ||
    profile.includes('nano banana 2.1') ||
    profile.includes('flux') ||
    profile.includes('midjourney') ||
    profile.includes('imagen')
  ) {
    return 'gemini-nano-banana-2.1';
  }

  return 'gemini-3.1-flash-lite-image';
}

function getModelAestheticDirective(modelProfile: string): string {
  const m = String(modelProfile || '').toLowerCase();
  if (m.includes('flux')) {
    return 'Photorealistic rectified-flow studio finish, natural skin/surface micro-texture, physically accurate reflections and shadows.';
  }
  if (m.includes('midjourney')) {
    return 'Cinematic editorial composition, dramatic depth, lush harmonious atmosphere, award-winning art direction.';
  }
  if (m.includes('imagen')) {
    return 'Hyper-crisp spatial accuracy, clean rendered typography if any text appears, balanced high-dynamic-range clarity.';
  }
  if (m.includes('dall-e')) {
    return 'Strict semantic prompt fidelity respecting every spatial relationship and object detail described.';
  }
  if (m.includes('leonardo')) {
    return 'Rich concept illustration & studio key lighting, crisp silhouette separation and material sheen.';
  }
  if (m.includes('stable diffusion') || m.includes('sd 3.5')) {
    return 'Dense dual-encoder compositional fidelity with intricate fine surface details and stylized depth.';
  }
  return 'Ultra-high clarity editorial production render with coherent lighting and clean anatomy.';
}

export function compileVisionPrompt(input: VisionCompileInput): string {
  const segments: string[] = [String(input.prompt || '').trim()];
  const cam = input.cameraSpec || {};

  if (input.style && input.style !== 'None') {
    segments.push(`Visual Style: ${input.style}.`);
  }

  const cameraParts = [
    cam.shotType && cam.shotType !== 'Auto' ? `${cam.shotType} framing` : '',
    cam.lens && cam.lens !== 'Auto' ? `shot on ${cam.lens}` : '',
    cam.aperture && cam.aperture !== 'Auto' ? `aperture ${cam.aperture}` : '',
    cam.composition && cam.composition !== 'Auto' ? `${cam.composition} composition` : '',
  ].filter(Boolean);
  if (cameraParts.length > 0) {
    segments.push(`Camera & Framing: ${cameraParts.join(', ')}.`);
  }

  const lightingParts = [
    cam.lighting && cam.lighting !== 'Auto' ? cam.lighting : '',
    cam.atmosphere && cam.atmosphere !== 'Auto' ? `${cam.atmosphere} atmosphere` : '',
  ].filter(Boolean);
  if (lightingParts.length > 0) {
    segments.push(`Lighting & Mood: ${lightingParts.join(', ')}.`);
  }

  if (cam.colorGrade && cam.colorGrade !== 'Auto') {
    segments.push(`Color Palette & Grading: ${cam.colorGrade}.`);
  }

  if (input.photoReal) {
    segments.push('Natural optical lens physics, realistic subsurface scattering, authentic textures.');
  }
  if (input.alchemy) {
    segments.push('High dynamic range micro-contrast, crisp rim highlights, rich depth separation.');
  }
  if (input.aspectRatio === '21:9') {
    segments.push('Compose cleanly for an ultra-wide 21:9 anamorphic cinema frame.');
  }

  segments.push(getModelAestheticDirective(input.model || ''));

  const neg = String(input.negativePrompt || '').trim();
  if (neg) {
    segments.push(`Strictly avoid / exclude: ${neg}.`);
  }

  return segments.filter(Boolean).join(' ');
}

export function compileVisionEditInstruction(opts: {
  instruction: string;
  operationType: VisionOperationType;
  hasMask: boolean;
  hasReferenceImages: boolean;
  preservationStrength: number;
  style?: string;
  cameraSpec?: VisionCameraSpec;
  negativePrompt?: string;
}): string {
  const preservePct = Math.min(100, Math.max(10, Math.round(opts.preservationStrength)));
  const opGuideMap: Record<VisionOperationType, string> = {
    generate: 'Create a cohesive image following the prompt.',
    edit: 'Modify the provided base image precisely according to the edit directive while keeping untouched subjects and lighting coherent.',
    inpaint: opts.hasMask
      ? 'Image 1 is the original base image. Image 2 is the painted edit mask where highlighted painted strokes mark the exact target region to replace or modify. Modify ONLY inside the masked region seamlessly matching surrounding perspective, shadows, and color temperature, and keep everything outside the mask unchanged.'
      : 'Seamlessly edit the specified target area while preserving surrounding environment and identity.',
    background_swap:
      'Keep the main foreground subject(s), pose, proportions, and edge hair/details cleanly preserved, and completely replace the background scene with realistic matching rim light and shadows.',
    object_remove:
      'Cleanly remove the specified object/person/artifact from the image and reconstruct natural occluded background texture, perspective lines, and lighting.',
    restyle:
      'Keep the exact spatial layout, subjects, and poses of the base image while transforming the artistic medium, textures, and color palette.',
    outpaint:
      'Extend the scene seamlessly beyond the existing framing, continuing matching architecture, horizon, lighting, and texture outward.',
    upscale:
      'Remaster and upscale the input image to crisp ultra-high-definition detail, sharpening skin pores, fabric weave, edges, reflections, and micro-textures without altering composition or subject identity.',
    variation:
      'Generate a fresh creative variation inspired closely by the provided reference image while keeping core motif and palette harmonious.',
  };

  const lines: string[] = [
    `OPERATION (${opts.operationType.toUpperCase()}): ${opGuideMap[opts.operationType] || opGuideMap.edit}`,
    `USER EDIT DIRECTIVE: "${opts.instruction}"`,
    `PRESERVATION CONSTRAINT: Preserve ~${preservePct}% of unmodified source composition, lighting geometry, and subject identity.`,
  ];

  if (opts.hasReferenceImages) {
    lines.push('Additional reference image(s) are attached after the base image — incorporate their visual style, object appearance, or character traits as directed.');
  }

  if (opts.style && opts.style !== 'None' && opts.operationType !== 'upscale') {
    lines.push(`Target Style: ${opts.style}.`);
  }

  const cam = opts.cameraSpec;
  if (cam?.lighting && cam.lighting !== 'Auto') {
    lines.push(`Lighting adjustment: ${cam.lighting}.`);
  }
  if (cam?.colorGrade && cam.colorGrade !== 'Auto') {
    lines.push(`Color grading: ${cam.colorGrade}.`);
  }
  if (opts.negativePrompt?.trim()) {
    lines.push(`Avoid: ${opts.negativePrompt.trim()}.`);
  }

  return lines.join('\n');
}

export interface EnhancedPromptResult {
  enhancedPrompt: string;
  suggestedNegativePrompt: string;
  providerUsed: string;
  breakdown: {
    subject: string;
    camera: string;
    lighting: string;
    mood: string;
  };
}

export function fallbackEnhanceVisionPrompt(
  rawPrompt: string,
  opts?: {
    mode?: VisionEnhancerMode;
    style?: string;
    cameraSpec?: VisionCameraSpec;
  }
): EnhancedPromptResult {
  const clean = String(rawPrompt || '').trim() || 'futuristic city skyline';
  const mode = opts?.mode || 'auto';
  const style = opts?.style || 'Cinematic Photoreal';
  const cam = opts?.cameraSpec || {};

  const modePresets: Record<
    VisionEnhancerMode,
    { lens: string; lighting: string; mood: string; negative: string; finish: string }
  > = {
    auto: {
      lens: cam.lens && cam.lens !== 'Auto' ? cam.lens : '50mm f/1.4 prime lens, crisp foreground focus and soft depth-of-field bokeh',
      lighting: cam.lighting && cam.lighting !== 'Auto' ? cam.lighting : 'dramatic volumetric rim lighting with soft bounced fill',
      mood: cam.colorGrade && cam.colorGrade !== 'Auto' ? cam.colorGrade : 'rich cinematic color grading, crisp micro-textures, ultra-detailed 8K master',
      negative: 'blurry, low resolution, muddy shadows, plastic skin, deformed hands, extra limbs, cropped frame, watermark, compression artifacts',
      finish: 'editorial commercial production quality',
    },
    cinematic: {
      lens: '35mm anamorphic cinema lens f/2.0, subtle halation and natural film grain',
      lighting: 'golden-hour directional sunlight slicing through atmospheric haze and subtle lens flare',
      mood: 'Hollywood IMAX still, Kodak Vision3 500T color science, deep shadows and glowing highlights',
      negative: 'flat lighting, CGI plastic look, overexposed clipping, amateur snapshot, text overlay, blurry',
      finish: 'shot on ARRI Alexa 65',
    },
    product: {
      lens: '85mm macro studio lens f/4, tack-sharp product contours with clean optical separation',
      lighting: 'overhead softbox key light with crisp specular rim highlights on matte dark backdrop',
      mood: 'luxury Apple/Porsche studio campaign aesthetic, pure surface reflections, balanced shadows',
      negative: 'cluttered background, harsh shadows, fingerprints, smudges, warped label text, low contrast, watermark',
      finish: 'commercial studio packshot',
    },
    anime: {
      lens: 'dynamic wide-angle storytelling framing with expressive perspective lines',
      lighting: 'luminous cel-shaded twilight glow with drifting light motes and dramatic silhouette rim',
      mood: 'Makoto Shinkai & ufotable inspired hand-painted background detail, saturated jewel tones',
      negative: '3d cgi render, photorealistic skin, muddy linework, fused fingers, low detail background, watermark',
      finish: 'masterpiece Japanese animation key visual',
    },
    concept3d: {
      lens: '24mm architectural & environment concept lens with clear depth layering',
      lighting: 'global illumination, volumetric god rays, atmospheric perspective fog',
      mood: 'Unreal Engine 5 / Octane Render PBR materials, weathered surface wear, intricate mechanical detail',
      negative: 'flat shading, low poly, noisy fireflies, untextured clay, watermark, blurry',
      finish: 'AAA environment concept art',
    },
    minimal: {
      lens: 'clean centered orthographic vector-inspired studio framing with generous negative space',
      lighting: 'soft even diffused gallery lighting without distracting harsh shadows',
      mood: 'modern Swiss graphic precision, harmonious 3-color palette, geometric clarity',
      negative: 'clutter, photoreal noise, complex busy textures, gradients, drop shadows, illegible small text',
      finish: 'high-craft minimalist art direction',
    },
  };

  const preset = modePresets[mode] || modePresets.auto;
  const enhancedPrompt = `${clean}, ${style} art direction, ${preset.finish}, captured with ${preset.lens}, illuminated by ${preset.lighting}, ${preset.mood}`;

  return {
    enhancedPrompt,
    suggestedNegativePrompt: preset.negative,
    providerUsed: 'raone-prompt-architect',
    breakdown: {
      subject: clean,
      camera: preset.lens,
      lighting: preset.lighting,
      mood: preset.mood,
    },
  };
}

export async function enhanceVisionPromptServer(opts: {
  prompt: string;
  mode?: VisionEnhancerMode;
  style?: string;
  cameraSpec?: VisionCameraSpec;
  geminiClient: GoogleGenAI | null;
  byok?: ByokKeyMap;
  fallbackGroqKey?: string;
}): Promise<EnhancedPromptResult> {
  const mode = opts.mode || 'auto';
  const style = opts.style || 'Cinematic Photoreal';
  const cleanPrompt = String(opts.prompt || '').trim();

  const instruction = `You are a world-class Creative Director & Visual Prompt Architect for text-to-image synthesis.
Even if the user gives only 1 or 2 words (or Sinhala/Singlish/English input), translate and expand their core intent into a vivid, coherent, non-bloated professional English visual prompt tailored to:
- Mode: ${mode}
- Target Style: ${style}
${opts.cameraSpec?.lens && opts.cameraSpec.lens !== 'Auto' ? `- Preferred Lens: ${opts.cameraSpec.lens}` : ''}
${opts.cameraSpec?.lighting && opts.cameraSpec.lighting !== 'Auto' ? `- Preferred Lighting: ${opts.cameraSpec.lighting}` : ''}
${opts.cameraSpec?.colorGrade && opts.cameraSpec.colorGrade !== 'Auto' ? `- Color Grade: ${opts.cameraSpec.colorGrade}` : ''}

Respond ONLY with strict JSON matching:
{
  "enhancedPrompt": "A rich single-paragraph prompt describing subject pose/action, environment details, camera lens/framing, lighting, materials/textures, and color mood.",
  "suggestedNegativePrompt": "concise comma-separated artifacts to avoid for this style",
  "breakdown": {
    "subject": "short phrase",
    "camera": "lens & framing",
    "lighting": "lighting setup",
    "mood": "palette & atmosphere"
  }
}

User input: "${cleanPrompt}"`;

  const tryParseJson = (rawText: string, providerLabel: string): EnhancedPromptResult | null => {
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first < 0 || last <= first) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(first, last + 1));
      if (typeof parsed.enhancedPrompt === 'string' && parsed.enhancedPrompt.trim().length > 12) {
        return {
          enhancedPrompt: parsed.enhancedPrompt.trim(),
          suggestedNegativePrompt:
            typeof parsed.suggestedNegativePrompt === 'string' && parsed.suggestedNegativePrompt.trim()
              ? parsed.suggestedNegativePrompt.trim()
              : 'blurry, low resolution, deformed anatomy, artifacts, watermark',
          providerUsed: providerLabel,
          breakdown: {
            subject: String(parsed.breakdown?.subject || cleanPrompt),
            camera: String(parsed.breakdown?.camera || 'Cinema prime lens'),
            lighting: String(parsed.breakdown?.lighting || 'Volumetric key + rim lighting'),
            mood: String(parsed.breakdown?.mood || style),
          },
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  if (opts.geminiClient) {
    try {
      const response = await opts.geminiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { role: 'user', parts: [{ text: instruction }] },
        config: {
          responseMimeType: 'application/json',
          systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
            provider: 'Google Gemini API',
            model: 'gemini-4-hydrogen',
            subsystem: 'RaOne Vision Studio Prompt Enhancer',
          }),
        },
      });
      const parsed = tryParseJson(response.text || '', 'gemini-4-hydrogen');
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('Gemini vision prompt enhance warning:', err?.message || err);
    }
  }

  const groqKey = opts.byok?.groqApiKey || opts.fallbackGroqKey;
  if (groqKey) {
    try {
      const res = await callGroqChat(
        groqKey,
        'raone-llama3-70b',
        [{ role: 'user', content: instruction }],
        `${SYSTEM_PROMPT}\nOutput valid JSON only.`,
        1024
      );
      const parsed = tryParseJson(res.text || '', res.modelUsed || 'groq');
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('Groq vision prompt enhance warning:', err?.message || err);
    }
  }

  const localCfg = getActiveLocalEndpointConfig(opts.byok || {});
  if (localCfg) {
    try {
      const res = await callLocalLlmChat({
        baseUrl: localCfg.baseUrl,
        modelId: localCfg.modelId,
        apiKey: localCfg.apiKey,
        messages: [],
        prompt: instruction,
        systemPrompt: 'Output valid JSON only with enhancedPrompt and suggestedNegativePrompt.',
      });
      const parsed = tryParseJson(res.text || '', `local:${localCfg.modelId}`);
      if (parsed) return parsed;
    } catch {
      // fall through to deterministic enhancer
    }
  }

  return fallbackEnhanceVisionPrompt(cleanPrompt, {
    mode,
    style,
    cameraSpec: opts.cameraSpec,
  });
}

export interface GeminiImageCallResult {
  base64Data: string;
  mimeType: string;
  aiNotes?: string;
  engineModelUsed: string;
}

export async function runGeminiImageContentCall(opts: {
  client: GoogleGenAI;
  engineModel: 'gemini-3.1-flash-lite-image' | 'gemini-nano-banana-2.1';
  parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>;
  aspectRatio: string;
  resolution: VisionResolutionTier;
  seed?: number;
  googleSearchGrounding?: boolean;
}): Promise<GeminiImageCallResult> {
  const apiAspect = normalizeAspectRatioForGemini(opts.aspectRatio, opts.engineModel);
  const imageConfig: Record<string, any> = {
    aspectRatio: apiAspect,
  };

  if (opts.engineModel === 'gemini-nano-banana-2.1') {
    imageConfig.imageSize = opts.resolution || '1K';
  }

  const config: Record<string, any> = {
    imageConfig,
  };

  if (typeof opts.seed === 'number' && Number.isFinite(opts.seed)) {
    config.seed = Math.abs(Math.floor(opts.seed)) % 2147483647;
  }

  if (opts.googleSearchGrounding && opts.engineModel === 'gemini-nano-banana-2.1') {
    config.tools = [
      {
        googleSearch: {
          searchTypes: {
            webSearch: {},
            imageSearch: {},
          },
        },
      },
    ];
  }

  const response = await opts.client.models.generateContent({
    model: opts.engineModel,
    contents: { parts: opts.parts },
    config,
  });

  let base64Data = '';
  let mimeType = 'image/png';
  const textNotes: string[] = [];

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data && !base64Data) {
      base64Data = part.inlineData.data;
      mimeType = part.inlineData.mimeType || 'image/png';
    } else if (part.text) {
      textNotes.push(part.text);
    }
  }

  if (!base64Data) {
    throw new Error('Upstream image model completed without returning an image payload.');
  }

  return {
    base64Data,
    mimeType,
    aiNotes: textNotes.join(' ').trim() || undefined,
    engineModelUsed: opts.engineModel,
  };
}

export function buildPublishedVisionHtml(snapshot: VisionPublishedSnapshot): string {
  const esc = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(snapshot.title)} — RaOne Vision Studio</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0d0e10; color: #ececec; display: flex; flex-direction: column; min-height: 100vh; }
    header { padding: 14px 24px; border-bottom: 1px solid #24262b; display: flex; align-items: center; justify-content: space-between; background: #131417; }
    main { flex: 1; display: grid; grid-template-columns: 1fr 340px; gap: 24px; padding: 24px; max-width: 1360px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
    .stage { background: #16171a; border: 1px solid #26282e; border-radius: 16px; padding: 16px; display: flex; align-items: center; justify-content: center; }
    .stage img { max-width: 100%; max-height: 78vh; border-radius: 10px; object-fit: contain; }
    .meta { background: #16171a; border: 1px solid #26282e; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .badge { display: inline-block; font-size: 11px; padding: 4px 10px; border-radius: 8px; background: #22252b; color: #8ab4f8; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8e918f; margin-bottom: 4px; }
    .val { font-size: 13px; line-height: 1.5; color: #e3e3e3; word-break: break-word; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 10px; background: #8ab4f8; color: #0e1014; font-weight: 600; font-size: 13px; text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <div><strong>RaOne Vision Studio</strong> · Shared Artwork</div>
    <a class="btn" href="${esc(snapshot.imageDataUrl)}" download="raone-vision-${esc(snapshot.imageId)}.png">Download Render</a>
  </header>
  <main>
    <div class="stage">
      <img src="${esc(snapshot.imageDataUrl)}" alt="${esc(snapshot.title)}" />
    </div>
    <aside class="meta">
      <div><span class="badge">${esc(snapshot.style)} · ${esc(snapshot.resolution)} · ${esc(snapshot.aspectRatio)}</span></div>
      <div><div class="label">Prompt</div><div class="val">${esc(snapshot.prompt)}</div></div>
      <div><div class="label">Engine Profile</div><div class="val">${esc(snapshot.model)} · ${esc(snapshot.dimensions)}</div></div>
      <div><div class="label">Seed</div><div class="val">${esc(String(snapshot.seed))}</div></div>
      ${snapshot.negativePrompt ? `<div><div class="label">Negative Prompt</div><div class="val">${esc(snapshot.negativePrompt)}</div></div>` : ''}
      <div><div class="label">Published</div><div class="val">${esc(new Date(snapshot.publishedAt).toLocaleString())}</div></div>
    </aside>
  </main>
</body>
</html>`;
}
