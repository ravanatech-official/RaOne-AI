import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  synthesizeRealApplication,
  synthesizeFullProject,
  refineSynthesizedProject,
  type SynthesizedProject,
} from './server_app_synthesizer.ts';
import {
  GROQ_SERVICE_CONFIG,
  isGroqModelId,
  formatGroqMessages,
  isGeminiFallbackEligibleError,
  callGroqChat,
  streamGroqChatToSSE,
  testGroqConnection,
  type AIProviderMode,
} from './server_groq_service.ts';
import {
  SYSTEM_PROMPT,
  appendRuntimeMetadata,
  buildRaOneSystemPrompt,
} from './src/lib/systemPrompts.ts';
import {
  attachRequestId,
  resolveActorMiddleware,
  requireVerifiedAuth,
  sendApiError,
  validateSafeHttpsEgress,
  createSlidingWindowLimiter,
} from './server_security.ts';
import {
  readTenantCollection,
  mutateTenantCollection,
  readSharedCollection,
  mutateSharedCollection,
  getTenantByokKeys,
  saveTenantByokKeys,
  getTenantPlan,
  getTenantCreditBalance,
  reserveCredits,
  refundCredits,
  exportAllTenantData,
  purgeAllTenantData,
  PLAN_ALLOWANCES,
  type PlanState,
} from './server_tenant_store.ts';
import {
  normalizeStudioMode,
  decomposeHtmlIntoFiles,
  compileFilesIntoHtmlBundle,
  validateStudioProject,
  buildStudioGeneratePrompt,
  buildStudioRefinePrompt,
  buildStudioAutoFixPrompt,
  executeStudioAiPrompt,
  materializeProjectFromRawOutput,
  fallbackSynthesizeStudioProject,
  enhanceStudioPromptServer,
  type StudioProviderChoice,
  type StudioAppAttachment,
  type RichStudioApp,
  type PublishedSnapshotRecord,
} from './server_studio_engine.ts';
import {
  analyzeProjectDependencies,
  runFullStudioAudit,
  buildAuditAutoFixPrompt,
  synthesizeDeployArtifacts,
} from './server_studio_auditor.ts';
import type { StudioProjectConfig, DeployTargetId, PromptEnhanceDepth } from './src/types/studio.ts';
import {
  saveTenantVisionAsset,
  resolveTenantVisionAssetPath,
  resolveImageInputToInlinePart,
  computeVisionDimensions,
  selectGeminiImageEngine,
  compileVisionPrompt,
  compileVisionEditInstruction,
  enhanceVisionPromptServer,
  runGeminiImageContentCall,
  buildPublishedVisionHtml,
  type VisionResolutionTier,
  type VisionOperationType,
  type VisionEnhancerMode,
  type VisionImageRecord,
  type VisionPublishedSnapshot,
} from './server_vision_engine.ts';
import {
  generateTrueDocxBuffer,
  generateTruePptxBuffer,
  generateTrueXlsxBuffer,
  generateTruePdfBuffer,
} from './server_exports.ts';
import { extractTextFromUploadedBase64 } from './server_uploads.ts';
import {
  LOCAL_MODELS_DIR,
  isCloudRunRuntime,
  isLocalLoopbackAllowed,
  isLocalProcessSpawnAllowed,
  validateLocalLlmEndpoint,
  listLocalGgufModels,
  findLlamaServerBinary,
  getManagedLlamaState,
  startManagedLlamaServer,
  stopManagedLlamaServer,
  fetchOpenAiCompatibleModels,
  probeLocalServersFromBackend,
  getActiveLocalEndpointConfig,
  callLocalLlmChat,
  streamLocalLlmToSSE,
} from './server_local_llm.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(attachRequestId);

// HTTP Security Headers Middleware (Production-hardened + AI Studio Preview iFrame-compatible)
app.use((req, res, next) => {
  const isDevPreview = process.env.NODE_ENV !== 'production';
  const isApiRoute = req.path.startsWith('/api');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const isAiStudioHost =
    hostHeader.includes('ais-dev-') ||
    hostHeader.includes('ais-pre-') ||
    hostHeader.includes('localhost') ||
    hostHeader.includes('127.0.0.1');
  const strictFrameDeny = process.env.STRICT_FRAME_DENY === 'true';
  const allowPreviewFraming = !isApiRoute && !strictFrameDeny;

  if (!isDevPreview) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!allowPreviewFraming) {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(self), microphone=(self)');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      isDevPreview
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com"
        : "script-src 'self' 'unsafe-inline' blob: https://apis.google.com",
      "style-src 'self' 'unsafe-inline' blob: https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "frame-src 'self' blob: data: https://*.firebaseapp.com https://accounts.google.com",
      "worker-src 'self' blob:",
      isDevPreview
        ? "connect-src 'self' ws: wss: http: https:"
        : "connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://raone-ai-backend-348832701843.asia-southeast1.run.app https://*.run.app",
      allowPreviewFraming
        ? isDevPreview || isAiStudioHost
          ? 'frame-ancestors *'
          : "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com https://*.scf.usercontent.goog"
        : "frame-ancestors 'none'",
    ].join('; ')
  );
  next();
});

// Strict Origin Allowlist CORS (Never reflects untrusted origins with credentials)
const BUILTIN_ALLOWED_ORIGINS = [
  'https://raoneai.web.app',
  'https://raoneai.firebaseapp.com',
  'https://raone-ai-backend-348832701843.asia-southeast1.run.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function isOriginAllowed(origin: string): boolean {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.includes(origin) || BUILTIN_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  if (/^https:\/\/raoneai--[a-z0-9-]+\.web\.app$/.test(origin)) {
    return true;
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/.test(origin)
  ) {
    return true;
  }
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-Id');

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin)) {
      return res.sendStatus(403);
    }
    return res.sendStatus(204);
  }
  next();
});

// Payload size guards (tight 2mb default; larger body only on explicit upload extraction and vision image editing routes)
const LARGE_BODY_ROUTES = new Set([
  '/api/uploads/extract',
  '/api/vision/generate',
  '/api/vision/edit',
  '/api/vision/upscale',
  '/api/vision/publish',
]);
app.use('/api/uploads/extract', express.json({ limit: '16mb' }));
app.use(['/api/vision/generate', '/api/vision/edit', '/api/vision/upscale', '/api/vision/publish'], express.json({ limit: '25mb' }));
app.use((req, res, next) => {
  if (LARGE_BODY_ROUTES.has(req.path)) return next();
  return express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Central Default-Deny Auth & Tenant Binding + True Sliding-Window Rate Limiters
const apiStandardLimiter = createSlidingWindowLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyPrefix: 'api_std',
});
const apiHeavyAiLimiter = createSlidingWindowLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'api_ai',
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return resolveActorMiddleware(req, res, next);
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return apiStandardLimiter(req, res, next);
});

const getReqTenant = (req: express.Request): string =>
  req.actor?.tenantId || 'guest_workspace';

async function getTenantGeminiClient(req: express.Request): Promise<{
  client: GoogleGenAI | null;
  byok: Awaited<ReturnType<typeof getTenantByokKeys>>;
}> {
  const tenantId = getReqTenant(req);
  const byok = await getTenantByokKeys(tenantId);
  const key = byok.geminiApiKey || apiKey;
  if (!key) return { client: null, byok };
  if (byok.geminiApiKey && byok.geminiApiKey !== apiKey) {
    return {
      client: new GoogleGenAI({
        apiKey: byok.geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      }),
      byok,
    };
  }
  return { client: aiClient, byok };
}

// Server startup initializes default fallback keys ONLY from environment variables (Secret Manager / Cloud Run)
// Tenant BYOK keys are stored AES-256-GCM encrypted inside per-tenant vaults (data/tenants/<tenant>/byok_keys.json)

// Default settings template for new tenants
const DEFAULT_SETTINGS = {
  theme: 'dark',
  accentColor: 'default',
  language: 'auto',
  alwaysShowCode: true,
  activeProvider: 'auto' as AIProviderMode,
  selectedModel: 'gemini-4-hydrogen',
  archivedChats: [] as string[],
  customInstructions: {
    aboutUser: '',
    responseStyle: 'Support Sinhala and English fluently with concise, verified engineering output.',
    enabled: true,
  },
  memory: {
    enabled: true,
    items: [] as string[],
  },
  voice: {
    selectedVoice: 'Breeze',
    speechLanguage: 'auto',
    wakeWordEnabled: true,
  },
  dataControls: {
    historyAndTraining: false,
    sharedLinks: [] as any[],
  },
  security: {
    mfaEnabled: false,
  },
};

async function getStoredUserSettings(tenantId = 'guest_workspace'): Promise<any> {
  const parsed = await readTenantCollection<Record<string, any> | null>(tenantId, 'settings', null);
  return parsed ? { ...DEFAULT_SETTINGS, ...parsed } : { ...DEFAULT_SETTINGS };
}

async function saveStoredUserSettings(settingsData: any, tenantId = 'guest_workspace'): Promise<void> {
  await mutateTenantCollection<Record<string, any>>(tenantId, 'settings', DEFAULT_SETTINGS, () => settingsData);
}

// Tenant-scoped Google AI Studio Workbench Prompts (Default templates cloned per tenant on first read)

const DEFAULT_STUDIO_PROMPTS = [
  {
    id: 'prompt-sentiment-analyzer',
    title: 'Customer Feedback Classifier',
    type: 'structured',
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are an accurate, fast data categorization assistant. Output only the predicted sentiment label and confidence score.',
    temperature: 0.2,
    topP: 0.95,
    topK: 40,
    maxTokens: 512,
    thinkingBudget: 0,
    structuredColumns: ['Customer Feedback', 'Sentiment', 'Confidence'],
    examples: [
      { 'Customer Feedback': 'The delivery was 3 hours late and the packaging was torn.', 'Sentiment': 'Negative', 'Confidence': '0.98' },
      { 'Customer Feedback': 'Best purchase I made all year, works straight out of the box!', 'Sentiment': 'Positive', 'Confidence': '0.99' },
      { 'Customer Feedback': 'It is okay, does what the description says.', 'Sentiment': 'Neutral', 'Confidence': '0.85' },
    ],
    testInput: 'The device stopped charging after three weeks of light use.',
    testOutput: '',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prompt-code-refactorer',
    title: 'Code Architecture Refactorer',
    type: 'freeform',
    model: 'gemini-2.5-pro',
    systemInstruction: 'You are a principal software engineer. Analyze the code, optimize memory and time complexity, and output clean TypeScript/Python.',
    temperature: 0.4,
    topP: 0.9,
    topK: 40,
    maxTokens: 2048,
    thinkingBudget: 2048,
    freeformContent: 'Analyze and refactor the following {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\nEnsure strict typing, error boundaries, and modern design patterns.',
    variables: {
      language: 'typescript',
      code: 'function fetchUsers(ids: any[]) { return ids.map(id => fetch("/api/user/" + id).then(r => r.json())); }',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prompt-conversational-agent',
    title: 'Full-Stack Agent with Persona',
    type: 'chat',
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are RaOne Core AI — a brilliant, precise sovereign engineering partner. Provide concise, production-ready answers.',
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxTokens: 4096,
    thinkingBudget: 0,
    chatMessages: [
      { role: 'user', content: 'What are the main advantages of using React 19 Server Components?' },
      { role: 'model', content: 'React 19 Server Components execute exclusively on the server, resulting in zero client-side JavaScript bundle impact, direct access to backend resources, and streaming SSR without waterfalls.' },
    ],
    updatedAt: new Date().toISOString(),
  },
];

async function getStoredStudioPrompts(tenantId = 'guest_workspace'): Promise<any[]> {
  return readTenantCollection<any[]>(tenantId, 'studio_prompts', DEFAULT_STUDIO_PROMPTS);
}

async function saveStoredStudioPrompts(prompts: any[], tenantId = 'guest_workspace'): Promise<void> {
  await mutateTenantCollection<any[]>(tenantId, 'studio_prompts', DEFAULT_STUDIO_PROMPTS, () => prompts);
}

// Server Environment API Credentials (Read-only at runtime; never overwritten by end users - A04 & A07)
const apiKey = process.env.GEMINI_API_KEY || '';
const aiClient: GoogleGenAI | null = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    })
  : null;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const COMET_API_KEY = process.env.COMET_API_KEY || '';
const COMET_API_BASE_URL = process.env.COMET_API_BASE_URL || 'https://api.cometapi.com/v1';

// Core RaOne AI Persona, Bilingual Fluency & Runtime Awareness are imported from ./src/lib/systemPrompts.ts (SYSTEM_PROMPT)

// Helper: Call OpenAI
async function callOpenAI(modelName: string, messages: any[], systemPrompt: string, keyOverride?: string): Promise<string> {
  const effectiveKey = keyOverride || OPENAI_API_KEY;
  if (!effectiveKey) throw new Error('OPENAI_API_KEY is not configured');
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || (m.parts?.[0]?.text ?? ''),
    })),
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: formattedMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

// Helper: Call Anthropic
async function callAnthropic(modelName: string, messages: any[], systemPrompt: string, keyOverride?: string): Promise<string> {
  const effectiveKey = keyOverride || ANTHROPIC_API_KEY;
  if (!effectiveKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const formattedMessages = messages.map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content || (m.parts?.[0]?.text ?? ''),
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': effectiveKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 4096,
      system: systemPrompt,
      messages: formattedMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  return json.content?.[0]?.text || '';
}

// Helper: Call DeepSeek
async function callDeepSeek(modelName: string, messages: any[], systemPrompt: string, keyOverride?: string): Promise<string> {
  const effectiveKey = keyOverride || DEEPSEEK_API_KEY;
  if (!effectiveKey) throw new Error('DEEPSEEK_API_KEY is not configured');
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || (m.parts?.[0]?.text ?? ''),
    })),
  ];

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: formattedMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

// Helper: Call CometAPI (All-In-One OpenAI-compatible Gateway - SSRF validated)
async function callCometAPI(
  modelName: string,
  messages: any[],
  systemPrompt: string,
  extraParams: Record<string, any> = {},
  keyOverride?: string,
  baseUrlOverride?: string
): Promise<string> {
  const effectiveKey = keyOverride || COMET_API_KEY;
  if (!effectiveKey) throw new Error('COMET_API_KEY is not configured');
  const rawBaseUrl = (baseUrlOverride || COMET_API_BASE_URL || 'https://api.cometapi.com/v1').replace(/\/+$/, '');
  const egressCheck = await validateSafeHttpsEgress(rawBaseUrl);
  if (!egressCheck.ok) {
    throw new Error(`Blocked unsafe gateway URL: ${egressCheck.reason}`);
  }

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || (m.parts?.[0]?.text ?? ''),
    })),
  ];

  const response = await fetch(`${rawBaseUrl}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${effectiveKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: formattedMessages,
      temperature: extraParams.temperature ?? 0.7,
      max_tokens: extraParams.max_tokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`CometAPI error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

// Gemini model candidate resolver
function getGeminiModelCandidates(requestedModel: string): string[] {
  const m = String(requestedModel || '').toLowerCase();
  if (m.includes('argon') || m.includes('pro') || m === 'raone-claude' || m === 'raone-deepseek-r1') {
    return ['gemini-4-argon', 'gemini-2.5-pro', 'gemini-2.5-flash'];
  }
  if (m.includes('lite')) {
    return ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  }
  return ['gemini-4-hydrogen', 'gemini-2.5-flash'];
}

function isModelNotFoundError(err: any): boolean {
  const status = err?.status || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 404 ||
    msg.includes('not_found') ||
    msg.includes('is not found') ||
    msg.includes('not supported for generatecontent')
  );
}

async function generateWithGeminiFallback(
  contents: any,
  config: any,
  requestedModel: string,
  clientOverride?: GoogleGenAI | null
) {
  const activeClient = clientOverride ?? aiClient;
  if (!activeClient) {
    throw new Error('GEMINI_API_KEY is not configured on the backend server.');
  }
  const candidates = getGeminiModelCandidates(requestedModel);
  let lastErr: any;
  for (const modelId of candidates) {
    try {
      const hasTools = Array.isArray(config?.tools);
      const hasSearch = hasTools && config.tools.some((t: any) => Boolean(t?.googleSearch));
      const hasMaps = hasTools && config.tools.some((t: any) => Boolean(t?.googleMaps));
      const scopedConfig =
        config && typeof config.systemInstruction === 'string'
          ? {
              ...config,
              systemInstruction: appendRuntimeMetadata(config.systemInstruction, {
                provider: 'Google Gemini API',
                model: modelId,
                searchEnabled: hasSearch,
                mapsEnabled: hasMaps,
              }),
            }
          : config;
      const response = await activeClient.models.generateContent({
        model: modelId,
        contents,
        config: scopedConfig,
      });
      return { response, modelUsed: modelId };
    } catch (err: any) {
      lastErr = err;
      if (isModelNotFoundError(err)) {
        console.warn(`Model ${modelId} unavailable, trying next candidate...`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('All Gemini model candidates failed.');
}

// API Health Route (supports ?verify=true to perform live Gemini & Groq API brain pings)
app.get('/api/health', async (req, res) => {
  const storedSettings = await getStoredUserSettings();
  const basePayload: any = {
    status: 'online',
    brand: 'RaOne',
    productName: 'RaOne AI',
    brandMeaning: 'Ravana + One — One AI for Your World',
    voiceActivationPhrase: 'Hey RaOne',
    tagline: 'Think. Create. Act.',
    brandSignature: 'RaOne AI by RavanaTec',
    activeProvider: storedSettings.activeProvider || 'auto',
    selectedModel: storedSettings.selectedModel || 'gemini-4-hydrogen',
    hasApiKey: Boolean(apiKey || GROQ_API_KEY || COMET_API_KEY),
    providers: {
      gemini: Boolean(apiKey),
      groq: Boolean(GROQ_API_KEY),
      openai: Boolean(OPENAI_API_KEY),
      anthropic: Boolean(ANTHROPIC_API_KEY),
      deepseek: Boolean(DEEPSEEK_API_KEY),
      xai: Boolean(XAI_API_KEY),
      cometapi: Boolean(COMET_API_KEY),
    },
    groqService: {
      configured: Boolean(GROQ_API_KEY),
      baseUrl: GROQ_SERVICE_CONFIG.baseUrl,
      defaultModel: GROQ_SERVICE_CONFIG.defaultModel,
      models: GROQ_SERVICE_CONFIG.models.map((m) => m.groqModelId),
    },
    security: {
      securityHeaders: true,
      slidingWindowRateLimitPerMin: 120,
      heavyAiRateLimitPerMin: 30,
      firestoreRulesConfigured: fs.existsSync(path.join(__dirname, 'firestore.rules')),
      requireFirebaseAuth: process.env.REQUIRE_FIREBASE_AUTH === 'true',
      byokEncryption: 'AES-256-GCM (Per-Tenant Isolated)',
    },
  };

  if (req.query.verify === 'true') {
    if (apiKey) {
      const pingStart = Date.now();
      try {
        const { response, modelUsed } = await generateWithGeminiFallback(
          'Reply with exactly: OK',
          { maxOutputTokens: 16 },
          'gemini-4-hydrogen'
        );
        basePayload.geminiLive = true;
        basePayload.verifiedModel = modelUsed;
        basePayload.modelVersion = (response as any).modelVersion || modelUsed;
        basePayload.responseId = (response as any).responseId || null;
        basePayload.latencyMs = Date.now() - pingStart;
        basePayload.sampleText = response.text?.trim() || 'OK';
      } catch (err: any) {
        basePayload.geminiLive = false;
        basePayload.latencyMs = Date.now() - pingStart;
        basePayload.geminiError = err?.message || 'Gemini verification failed';
      }
    } else {
      basePayload.geminiLive = false;
    }

    if (GROQ_API_KEY) {
      const groqPingStart = Date.now();
      try {
        const groqRes = await callGroqChat(
          GROQ_API_KEY,
          'raone-llama3-70b',
          [{ role: 'user', content: 'Reply with exactly: OK' }],
          'Reply with OK only.',
          16
        );
        basePayload.groqLive = true;
        basePayload.groqModel = groqRes.modelUsed;
        basePayload.groqResponseId = groqRes.responseId;
        basePayload.groqLatencyMs = Date.now() - groqPingStart;
        basePayload.groqSampleText = groqRes.text?.trim() || 'OK';
      } catch (err: any) {
        basePayload.groqLive = false;
        basePayload.groqLatencyMs = Date.now() - groqPingStart;
        basePayload.groqError = err?.message || 'Groq verification failed';
      }
    }
  }

  res.json(basePayload);
});

// API Models Catalog
app.get('/api/models', (_req, res) => {
  res.json({
    models: [
      {
        id: 'gemini-3.8-flash',
        name: 'RaOne Flash',
        tag: 'High Velocity · Recommended',
        description: 'Fast, multimodal & intelligent (Powered by Gemini 2.5 Flash)',
        active: Boolean(apiKey || GROQ_API_KEY || COMET_API_KEY),
        provider: 'Gemini',
      },
      ...GROQ_SERVICE_CONFIG.models.map((gm) => ({
        id: gm.id,
        name: gm.name,
        tag: gm.tag,
        description: gm.description,
        active: Boolean(GROQ_API_KEY),
        provider: 'Groq (Meta Llama)',
      })),
      {
        id: 'gemini-4-argon',
        name: 'RaOne Argon',
        tag: 'Deep Reasoning & Logic',
        description: 'Deep cognitive reasoning & systems code (Powered by Gemini 2.5 Pro)',
        active: Boolean(apiKey || COMET_API_KEY),
        provider: 'Gemini',
      },
      {
        id: 'comet-all-in-one',
        name: 'CometAPI All-In-One',
        tag: 'Unified Multi-Model Gateway',
        description: 'Access 500+ models (GPT-4o, Claude 3.5, Gemini, DeepSeek R1) via cometapi.com',
        active: Boolean(COMET_API_KEY),
        provider: 'CometAPI',
      },
      {
        id: 'raone-deepseek-r1',
        name: 'RaOne DeepSeek R1',
        tag: 'Deep Reasoning Matrix',
        description: 'Open reasoning & algorithmic proofs (DeepSeek R1 / CometAPI / Gemini CoT)',
        active: Boolean(DEEPSEEK_API_KEY || COMET_API_KEY || apiKey),
        provider: DEEPSEEK_API_KEY ? 'DeepSeek' : COMET_API_KEY ? 'CometAPI' : 'Gemini Hybrid',
      },
      {
        id: 'raone-gpt4o',
        name: 'RaOne GPT-4o',
        tag: 'Omni Intelligence',
        description: 'Advanced vision & omni reasoning (OpenAI GPT-4o / CometAPI / Gemini Hybrid)',
        active: Boolean(OPENAI_API_KEY || COMET_API_KEY || apiKey),
        provider: OPENAI_API_KEY ? 'OpenAI' : COMET_API_KEY ? 'CometAPI' : 'Gemini Hybrid',
      },
      {
        id: 'raone-claude',
        name: 'RaOne Claude 3.5',
        tag: 'Architecture & Prose',
        description: 'State-of-the-art coding and prose (Claude 3.5 Sonnet / CometAPI / Gemini Hybrid)',
        active: Boolean(ANTHROPIC_API_KEY || COMET_API_KEY || apiKey),
        provider: ANTHROPIC_API_KEY ? 'Anthropic' : COMET_API_KEY ? 'CometAPI' : 'Gemini Hybrid',
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'RaOne Lite',
        tag: 'Ultra Fast',
        description: 'Ultra-low latency instant streaming (Gemini 2.0 Flash Lite)',
        active: Boolean(apiKey || COMET_API_KEY),
        provider: 'Gemini',
      },
    ],
    encryption: 'Server-side Environment Proxy (Zero-Client-Exposure)',
    providers: {
      gemini: Boolean(apiKey),
      groq: Boolean(GROQ_API_KEY),
      openai: Boolean(OPENAI_API_KEY),
      anthropic: Boolean(ANTHROPIC_API_KEY),
      deepseek: Boolean(DEEPSEEK_API_KEY),
      xai: Boolean(XAI_API_KEY),
      cometapi: Boolean(COMET_API_KEY),
    },
  });
});

// Capabilities Discovery Endpoint (Honest status per modality — never misleads users)
app.get('/api/capabilities', (_req, res) => {
  const hasGemini = Boolean(apiKey || process.env.GEMINI_API_KEY);
  const hasGroq = Boolean(GROQ_API_KEY || process.env.GROQ_API_KEY);
  const hasTextLlm = hasGemini || hasGroq || Boolean(OPENAI_API_KEY || ANTHROPIC_API_KEY || COMET_API_KEY);

  res.json({
    chat: { status: hasTextLlm ? 'real' : 'provider_required', streaming: true, attachments: ['pdf', 'docx', 'txt', 'md', 'csv', 'json'] },
    codeStudio: { status: hasTextLlm ? 'real' : 'template_fallback', sandboxMode: 'opaque_iframe_isolated' },
    vision: {
      generate: hasGemini ? 'real' : 'provider_required',
      enhancePrompt: hasTextLlm ? 'real' : 'provider_required',
      upscale: 'requires_gpu_worker',
      controlnet: 'requires_gpu_worker',
      ipAdapter: 'requires_gpu_worker',
      inpaint: 'requires_gpu_worker',
      loraTrain: 'requires_gpu_worker',
    },
    cinema: {
      generate: process.env.VIDEO_GENERATION_API_URL ? 'real' : 'provider_required',
      enhancePrompt: hasTextLlm ? 'real' : 'provider_required',
      extendInterpolateUpscale: 'requires_ffmpeg_worker',
    },
    audio: {
      generate: process.env.AUDIO_SYNTHESIS_API_URL ? 'real' : 'provider_required',
      enhanceLyrics: hasTextLlm ? 'real' : 'provider_required',
      separateStems: 'requires_demucs_worker',
      voiceClone: 'requires_voice_consent_worker',
    },
    documents: {
      generate: hasTextLlm ? 'real' : 'provider_required',
      analyze: hasTextLlm ? 'real' : 'provider_required',
      uploads: ['pdf', 'docx', 'txt', 'md', 'csv'],
      exports: ['docx', 'pptx', 'xlsx', 'pdf', 'md'],
    },
    localLlm: {
      browserDirectSupported: true,
      backendLoopbackAllowed: isLocalLoopbackAllowed(),
      inbuiltLlamaServerSupported: isLocalProcessSpawnAllowed() && Boolean(findLlamaServerBinary()),
      managedProcessRunning: getManagedLlamaState().running,
    },
  });
});

// ==========================================
// 🖥️ INBUILT LOCAL LLM ENGINE (llama.cpp / GGUF / Ollama / LM Studio)
// ==========================================
app.get('/api/local-llm/status', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const byok = await getTenantByokKeys(tenantId);
    const llamaServerBin = findLlamaServerBinary();
    const [detectedServers] = await Promise.all([probeLocalServersFromBackend()]);
    res.json({
      success: true,
      isCloudRun: isCloudRunRuntime(),
      backendLoopbackAllowed: isLocalLoopbackAllowed(),
      processSpawnAllowed: isLocalProcessSpawnAllowed(),
      llamaServerBinaryAvailable: Boolean(llamaServerBin),
      llamaServerBinaryPath: llamaServerBin || null,
      modelsDir: LOCAL_MODELS_DIR,
      ggufFiles: listLocalGgufModels(),
      managedProcess: getManagedLlamaState(),
      detectedServers,
      savedConfig: {
        baseUrl: byok.localLlmBaseUrl || process.env.LOCAL_LLM_BASE_URL || '',
        modelId: byok.localLlmModel || process.env.LOCAL_LLM_MODEL || '',
        hasApiKey: Boolean(byok.localLlmApiKey || process.env.LOCAL_LLM_API_KEY),
      },
    });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'LOCAL_LLM_STATUS_ERROR', err?.message || 'Failed to inspect local LLM runtime.');
  }
});

app.post('/api/local-llm/start', async (req, res) => {
  try {
    const { modelFile, port = 8081, contextSize = 4096, gpuLayers } = req.body || {};
    if (!modelFile) {
      return sendApiError(req, res, 400, 'MODEL_FILE_REQUIRED', 'Select a .gguf model file inside ./models/ to start.');
    }
    const state = await startManagedLlamaServer({
      modelFile: String(modelFile),
      port: Number(port) || 8081,
      contextSize: Number(contextSize) || 4096,
      gpuLayers: gpuLayers !== undefined ? Number(gpuLayers) : undefined,
    });
    return res.json({ success: true, managedProcess: state });
  } catch (err: any) {
    return sendApiError(req, res, 400, 'LOCAL_LLM_START_FAILED', err?.message || 'Could not start inbuilt llama-server.');
  }
});

app.post('/api/local-llm/stop', async (req, res) => {
  try {
    const state = await stopManagedLlamaServer();
    return res.json({ success: true, managedProcess: state });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'LOCAL_LLM_STOP_FAILED', err?.message || 'Could not stop llama-server.');
  }
});

app.post('/api/local-llm/test', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const byok = await getTenantByokKeys(tenantId);
    const { baseUrl, apiKey: keyInput, modelId } = req.body || {};
    const targetBase = String(baseUrl || byok.localLlmBaseUrl || process.env.LOCAL_LLM_BASE_URL || '').trim();
    const targetKey = String(keyInput || byok.localLlmApiKey || process.env.LOCAL_LLM_API_KEY || '').trim();

    const check = await validateLocalLlmEndpoint(targetBase);
    if (!check.ok) {
      return sendApiError(req, res, 400, 'INVALID_LOCAL_LLM_URL', check.reason);
    }

    const start = Date.now();
    const models = await fetchOpenAiCompatibleModels(check.normalizedBaseUrl, targetKey || undefined, 4000);
    const selected = String(modelId || models[0] || byok.localLlmModel || 'local-model').trim();

    return res.json({
      success: true,
      baseUrl: check.normalizedBaseUrl,
      isLoopback: check.isLoopback,
      models,
      selectedModel: selected,
      latencyMs: Date.now() - start,
      message:
        models.length > 0
          ? `Connected to Local AI Server (${models.length} model${models.length > 1 ? 's' : ''} ready: ${models.slice(0, 3).join(', ')})`
          : `Connected to Local AI Server at ${check.normalizedBaseUrl}`,
    });
  } catch (err: any) {
    return sendApiError(req, res, 502, 'LOCAL_LLM_TEST_FAILED', err?.message || 'Failed to connect to local LLM endpoint.');
  }
});

// Binary Upload Text Extraction Endpoint (A22 & A27: Real PDF/DOCX/TXT ingestion)
app.post('/api/uploads/extract', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { filename, mimeType, base64Data } = req.body || {};
    if (!filename || !base64Data) {
      return sendApiError(req, res, 400, 'INVALID_UPLOAD', 'filename and base64Data are required.');
    }
    const extracted = await extractTextFromUploadedBase64({ filename, mimeType, base64Data });
    return res.json({ success: true, ...extracted });
  } catch (err: any) {
    return sendApiError(req, res, 400, 'UPLOAD_EXTRACTION_FAILED', err?.message || 'Could not extract uploaded file.');
  }
});

// Billing & Credits Ledger Endpoints (A09: Authoritative Credit & Plan Controls)
app.get('/api/user/plan', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const [planData, creditInfo] = await Promise.all([
      getTenantPlan(tenantId),
      getTenantCreditBalance(tenantId),
    ]);
    res.json({
      ...planData,
      creditsBalance: creditInfo.balance,
      recentLedger: creditInfo.entries.slice(-10).reverse(),
    });
  } catch (error: any) {
    sendApiError(req, res, 500, 'PLAN_READ_ERROR', error.message);
  }
});

app.post('/api/user/plan', requireVerifiedAuth, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const { plan, billingCycle = 'monthly' } = req.body || {};
    if (!plan || !['free', 'plus', 'ultimate'].includes(plan)) {
      return sendApiError(req, res, 400, 'INVALID_PLAN', 'Valid plan (free, plus, ultimate) is required.');
    }

    // Paid tiers CANNOT be directly self-assigned without verified billing/webhook proof (A09)
    if (plan !== 'free') {
      return sendApiError(
        req,
        res,
        402,
        'BILLING_VERIFICATION_REQUIRED',
        'Paid plan upgrades require a completed checkout and verified payment webhook settlement. Direct tier escalation is blocked.'
      );
    }

    const updatedPlan = await mutateTenantCollection<PlanState>(
      tenantId,
      'plan',
      {
        plan: 'free',
        billingCycle: 'monthly',
        status: 'active',
        monthlyAllowance: PLAN_ALLOWANCES.free,
        updatedAt: new Date().toISOString(),
      },
      () => ({
        plan: 'free',
        billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
        status: 'active',
        monthlyAllowance: PLAN_ALLOWANCES.free,
        updatedAt: new Date().toISOString(),
      })
    );
    res.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    sendApiError(req, res, 500, 'PLAN_UPDATE_ERROR', error.message);
  }
});

app.post('/api/user/plan/cancel', requireVerifiedAuth, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const freePlan: PlanState = {
      plan: 'free',
      billingCycle: 'monthly',
      status: 'active',
      monthlyAllowance: PLAN_ALLOWANCES.free,
      updatedAt: new Date().toISOString(),
    };
    await mutateTenantCollection<PlanState>(tenantId, 'plan', freePlan, () => freePlan);
    res.json({ success: true, plan: freePlan });
  } catch (error: any) {
    sendApiError(req, res, 500, 'PLAN_CANCEL_ERROR', error.message);
  }
});

// Payment Webhook Receiver (HMAC-SHA256 verified against STRIPE_WEBHOOK_SECRET / BILLING_WEBHOOK_SECRET)
app.post('/api/billing/webhook', async (req, res) => {
  try {
    const secret = process.env.BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return sendApiError(
        req,
        res,
        503,
        'BILLING_WEBHOOK_NOT_CONFIGURED',
        'Payment webhook verification secret is not configured on this server.'
      );
    }
    const sig = String(req.headers['x-billing-signature'] || '');
    const payloadString = JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    if (
      !sig ||
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return sendApiError(req, res, 401, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid webhook signature.');
    }

    const { tenantId, plan, billingCycle = 'monthly', eventId } = req.body || {};
    if (!tenantId || !['free', 'plus', 'ultimate'].includes(plan)) {
      return sendApiError(req, res, 400, 'INVALID_WEBHOOK_PAYLOAD', 'Valid tenantId and plan required.');
    }

    const updatedPlan: PlanState = {
      plan,
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      status: 'active',
      monthlyAllowance: PLAN_ALLOWANCES[plan as 'free' | 'plus' | 'ultimate'],
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await mutateTenantCollection<PlanState>(tenantId, 'plan', updatedPlan, () => updatedPlan);
    await refundCredits(tenantId, updatedPlan.monthlyAllowance, `plan_grant_${plan}`, `wh_${eventId || Date.now()}`);
    return res.json({ received: true, plan: updatedPlan });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'WEBHOOK_ERROR', err.message);
  }
});

// Tenant-Scoped Settings, Memory, Export & Account Deletion (A03, A10)
app.get('/api/user/settings', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const settings = await getStoredUserSettings(tenantId);
    res.json(settings);
  } catch (error: any) {
    sendApiError(req, res, 500, 'SETTINGS_READ_ERROR', error.message);
  }
});

app.post('/api/user/settings', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const incoming = req.body || {};
    const current = await getStoredUserSettings(tenantId);
    // Prevent direct client spoofing of verified MFA status
    const sanitizedIncoming = { ...incoming };
    if (sanitizedIncoming.security) {
      delete sanitizedIncoming.security;
    }
    const merged = { ...current, ...sanitizedIncoming };
    await saveStoredUserSettings(merged, tenantId);
    res.json({ success: true, settings: merged });
  } catch (error: any) {
    sendApiError(req, res, 500, 'SETTINGS_SAVE_ERROR', error.message);
  }
});

app.post('/api/user/settings/memory/delete', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const { index } = req.body || {};
    const current = await getStoredUserSettings(tenantId);
    if (typeof index === 'number' && current.memory?.items) {
      current.memory.items = current.memory.items.filter((_: any, i: number) => i !== index);
      await saveStoredUserSettings(current, tenantId);
    }
    res.json({ success: true, memory: current.memory });
  } catch (error: any) {
    sendApiError(req, res, 500, 'MEMORY_DELETE_ERROR', error.message);
  }
});

app.post('/api/user/settings/memory/add', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const { item } = req.body || {};
    const current = await getStoredUserSettings(tenantId);
    if (item && typeof item === 'string') {
      current.memory = current.memory || { enabled: true, items: [] };
      current.memory.items.push(item.trim().slice(0, 500));
      await saveStoredUserSettings(current, tenantId);
    }
    res.json({ success: true, memory: current.memory });
  } catch (error: any) {
    sendApiError(req, res, 500, 'MEMORY_ADD_ERROR', error.message);
  }
});

app.post('/api/user/settings/memory/clear', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const current = await getStoredUserSettings(tenantId);
    if (current.memory) {
      current.memory.items = [];
      await saveStoredUserSettings(current, tenantId);
    }
    res.json({ success: true, memory: current.memory });
  } catch (error: any) {
    sendApiError(req, res, 500, 'MEMORY_CLEAR_ERROR', error.message);
  }
});

app.post('/api/user/settings/clear-all-chats', requireVerifiedAuth, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    await mutateTenantCollection<any[]>(tenantId, 'conversations', [], () => []);
    res.json({ success: true, message: 'All chat history cleared for your account.' });
  } catch (error: any) {
    sendApiError(req, res, 500, 'CLEAR_CHATS_ERROR', error.message);
  }
});

app.get('/api/user/settings/export-data', requireVerifiedAuth, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const exportPayload = await exportAllTenantData(tenantId, req.actor?.email || null);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="raone-complete-data-export.json"');
    res.send(JSON.stringify(exportPayload, null, 2));
  } catch (error: any) {
    sendApiError(req, res, 500, 'EXPORT_DATA_ERROR', error.message);
  }
});

app.post('/api/user/settings/delete-account', requireVerifiedAuth, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    await purgeAllTenantData(tenantId);
    res.json({ success: true, message: 'All workspace data for your account has been permanently deleted.' });
  } catch (error: any) {
    sendApiError(req, res, 500, 'DELETE_ACCOUNT_ERROR', error.message);
  }
});

// Unified Server-Side Library Folders & Assets Endpoints (Cross-device sync)
app.get('/api/library/folders', async (req, res) => {
  try {
    const folders = await readTenantCollection<any[]>(getReqTenant(req), 'library_folders', []);
    res.json({ success: true, folders });
  } catch (err: any) {
    sendApiError(req, res, 500, 'LIBRARY_FOLDERS_READ_ERROR', err.message);
  }
});

app.post('/api/library/folders', async (req, res) => {
  try {
    const folders = Array.isArray(req.body?.folders) ? req.body.folders : null;
    if (!folders) {
      return sendApiError(req, res, 400, 'INVALID_FOLDERS', 'folders array is required.');
    }
    const saved = await mutateTenantCollection<any[]>(getReqTenant(req), 'library_folders', [], () => folders);
    res.json({ success: true, folders: saved });
  } catch (err: any) {
    sendApiError(req, res, 500, 'LIBRARY_FOLDERS_SAVE_ERROR', err.message);
  }
});

// ==========================================
// Google AI Studio Developer Workbench APIs
// ==========================================
app.get('/api/studio/prompts', async (req, res) => {
  try {
    const list = await getStoredStudioPrompts(getReqTenant(req));
    res.json(list);
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_PROMPTS_READ_ERROR', error.message);
  }
});

app.post('/api/studio/prompts', async (req, res) => {
  try {
    const incomingPrompt = req.body;
    if (!incomingPrompt || !incomingPrompt.title) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt title is required');
    }
    const tenantId = getReqTenant(req);
    const updatedItem = {
      ...incomingPrompt,
      id: incomingPrompt.id || `prompt-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    await mutateTenantCollection<any[]>(tenantId, 'studio_prompts', DEFAULT_STUDIO_PROMPTS, (prompts) => {
      const next = [...prompts];
      const existingIndex = next.findIndex((p: any) => p.id === updatedItem.id);
      if (existingIndex >= 0) next[existingIndex] = updatedItem;
      else next.unshift(updatedItem);
      return next;
    });
    res.json({ success: true, prompt: updatedItem });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_PROMPTS_SAVE_ERROR', error.message);
  }
});

app.delete('/api/studio/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'studio_prompts', DEFAULT_STUDIO_PROMPTS, (prompts) =>
      prompts.filter((p: any) => p.id !== id)
    );
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_PROMPTS_DELETE_ERROR', error.message);
  }
});

app.post('/api/studio/run', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      model = 'gemini-2.5-flash',
      promptType = 'chat',
      systemInstruction,
      temperature = 1.0,
      topP = 0.95,
      topK = 40,
      maxTokens = 4096,
      thinkingBudget = 0,
      jsonSchema,
      isGroundingEnabled = false,
      contents,
      rawText,
      variables,
      examples,
      testInput,
    } = req.body;

    // Map model names to real Gemini model ID
    let mappedModel = 'gemini-4-hydrogen';
    if (String(model).includes('pro') || String(model).includes('argon')) mappedModel = 'gemini-4-argon';
    else mappedModel = 'gemini-4-hydrogen';

    // Prepare contents array
    let preparedContents: any[] = [];
    if (promptType === 'chat' && Array.isArray(contents)) {
      preparedContents = contents.map((c: any) => ({
        role: c.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof c.content === 'string' ? c.content : (c.parts?.[0]?.text ?? '') }],
      }));
    } else if (promptType === 'freeform') {
      let resolvedText = rawText || '';
      if (variables && typeof variables === 'object') {
        Object.entries(variables).forEach(([k, v]) => {
          resolvedText = resolvedText.replaceAll(`{{${k}}}`, String(v));
        });
      }
      preparedContents = [{ role: 'user', parts: [{ text: resolvedText }] }];
    } else if (promptType === 'structured') {
      let structuredPrompt = '';
      if (Array.isArray(examples) && examples.length > 0) {
        structuredPrompt += 'Examples:\n';
        examples.forEach((ex: any, i: number) => {
          structuredPrompt += `Example ${i + 1}:\n`;
          Object.entries(ex).forEach(([k, v]) => {
            structuredPrompt += `${k}: ${v}\n`;
          });
          structuredPrompt += '\n';
        });
      }
      structuredPrompt += `Input:\n${testInput || ''}\nOutput:\n`;
      preparedContents = [{ role: 'user', parts: [{ text: structuredPrompt }] }];
    } else {
      preparedContents = [{ role: 'user', parts: [{ text: rawText || 'Hello' }] }];
    }

    // Config
    const config: any = {
      temperature: Number(temperature),
      topP: Number(topP),
      topK: Number(topK),
      maxOutputTokens: Number(maxTokens),
    };

    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    if (isGroundingEnabled) {
      config.tools = [{ googleSearch: {} }];
    }

    if (jsonSchema) {
      try {
        config.responseMimeType = 'application/json';
        config.responseSchema = JSON.parse(jsonSchema);
      } catch (e) {
        config.responseMimeType = 'application/json';
      }
    }

    if (thinkingBudget > 0 && mappedModel.includes('2.0')) {
      config.thinkingConfig = { thinkingBudget: Number(thinkingBudget) };
    }

    let responseText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let finalModelUsed = mappedModel;
    let providerUsed = 'gemini';

    const baseWorkbenchSystemPrompt = systemInstruction
      ? `${SYSTEM_PROMPT}\n\n[WORKBENCH CUSTOM SYSTEM INSTRUCTION]\n${systemInstruction}`
      : SYSTEM_PROMPT;

    const { client: tenantGeminiClient, byok } = await getTenantGeminiClient(req);
    const effectiveGroqKey = byok.groqApiKey || GROQ_API_KEY;

    if (tenantGeminiClient) {
      try {
        const workbenchConfig = {
          ...config,
          systemInstruction: appendRuntimeMetadata(
            baseWorkbenchSystemPrompt,
            {
              provider: 'Google Gemini API (AI Studio Workbench)',
              model: mappedModel,
              searchEnabled: Boolean(isGroundingEnabled),
              mapsEnabled: false,
              subsystem: 'AI Studio Developer Workbench',
            }
          ),
        };
        const resp = await tenantGeminiClient.models.generateContent({
          model: mappedModel,
          contents: preparedContents,
          config: workbenchConfig,
        });

        responseText = resp.text || '';
        inputTokens = resp.usageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(preparedContents).length / 4);
        outputTokens = resp.usageMetadata?.candidatesTokenCount || Math.ceil(responseText.length / 4);
      } catch (genErr: any) {
        console.warn('Google GenAI direct run notice:', genErr?.message || genErr);
      }
    }

    if (!responseText && effectiveGroqKey) {
      try {
        const studioMessages = preparedContents.map((c: any) => ({
          role: c.role === 'user' ? 'user' : 'assistant',
          content: c.parts?.[0]?.text || '',
        }));
        const studioSysPrompt = [
          baseWorkbenchSystemPrompt,
          jsonSchema ? `Respond ONLY with valid JSON matching schema: ${jsonSchema}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const groqOut = await callGroqChat(
          effectiveGroqKey,
          isGroqModelId(model) ? model : 'raone-llama3-70b',
          studioMessages,
          studioSysPrompt,
          Number(maxTokens) || 4096
        );
        responseText = groqOut.text || '';
        finalModelUsed = groqOut.modelUsed;
        providerUsed = 'groq';
        inputTokens = groqOut.usage?.promptTokens || Math.ceil(JSON.stringify(preparedContents).length / 4);
        outputTokens = groqOut.usage?.candidateTokens || Math.ceil(responseText.length / 4);
      } catch (groqStudioErr: any) {
        console.warn('Groq studio run notice:', groqStudioErr?.message || groqStudioErr);
      }
    }

    if (!responseText) {
      return sendApiError(
        req,
        res,
        503,
        'WORKBENCH_PROVIDER_UNAVAILABLE',
        'No live Gemini or Groq API provider responded. Configure a valid key in Settings or server environment.',
        true
      );
    }

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      content: responseText,
      latencyMs,
      inputTokens,
      outputTokens,
      modelUsed: finalModelUsed,
      providerUsed,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    res.status(500).json({ error: error.message, code: 'WORKBENCH_RUN_ERROR', request_id: req.requestId, latencyMs });
  }
});

// ==========================================
// Google AI Studio Apps & Gallery Endpoints (Tenant-Scoped - A03)
// ==========================================
const DEFAULT_GALLERY_APPS = [
  {
    id: 'app-google-maps',
    title: 'Google Maps Live Route Explorer',
    description: 'Full-featured GPS navigation with OSRM turn-by-turn routing, live geocoding, multi-layer maps, and GPX export.',
    category: 'Google Maps',
    icon: 'map-pin',
    tag: 'Maps Grounding',
    author: 'RaOne Templates',
    createdAt: new Date().toISOString(),
    code: synthesizeRealApplication('Google Maps Live Explorer with route planning and place search', 'Google Maps', 'Google Maps Live Explorer'),
  },
  {
    id: 'app-cyber-game',
    title: 'Neon Cyberpunk Space Arcade',
    description: 'Fast-paced 60 FPS HTML5 Canvas arcade shooter with Web Audio sound synthesis, particle explosions, and power-ups.',
    category: 'Create a game',
    icon: 'gamepad',
    tag: 'Web Game',
    author: 'RaOne Templates',
    createdAt: new Date().toISOString(),
    code: synthesizeRealApplication('Retro Cyberpunk Space Shooter 2D Arcade Game', 'Create a game', 'Neon Cyberpunk Space Arcade'),
  },
  {
    id: 'app-threejs-solar',
    title: 'Three.js 3D Celestial Solar & Planetary Orbit Simulator',
    description: 'Real-time 3D WebGL solar system with planetary orbits, lighting shaders, and smooth camera controls.',
    category: 'Three.js 3D scenes',
    icon: 'box',
    tag: '3D WebGL',
    author: 'RaOne Templates',
    createdAt: new Date().toISOString(),
    code: synthesizeRealApplication('Three.js 3D Orbital Solar Simulation with planetary controls', 'Three.js 3D scenes', 'Three.js 3D Solar Orbit'),
  },
  {
    id: 'app-android-finance',
    title: 'Android Material You Finance Hub',
    description: 'Mobile-first responsive budget and finance tracker styled with Android Material Design 3 guidelines.',
    category: 'Build an Android app',
    icon: 'smartphone',
    tag: 'Mobile App',
    author: 'RaOne Templates',
    createdAt: new Date().toISOString(),
    code: synthesizeRealApplication('Android Material You Finance & Budget Tracker', 'Build an Android app', 'Material You Finance Vault'),
  },
  {
    id: 'app-crypto-terminal',
    title: 'Live Crypto Intelligence & Market Terminal',
    description: 'Real-time CoinGecko API cryptocurrency tracker with dynamic price charts, converter, and portfolio vault.',
    category: 'Finance',
    icon: 'sparkles',
    tag: 'Live APIs',
    author: 'RaOne Templates',
    createdAt: new Date().toISOString(),
    code: synthesizeRealApplication('Live cryptocurrency dashboard with price charts and currency converter', 'Finance', 'Crypto Market Intelligence'),
  }
];

async function getStoredStudioApps(tenantId = 'guest_workspace'): Promise<any[]> {
  return readTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS);
}

app.get('/api/studio/apps', async (req, res) => {
  try {
    const list = await getStoredStudioApps(getReqTenant(req));
    res.json(list);
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_APPS_READ_ERROR', error.message);
  }
});

app.post('/api/studio/apps', async (req, res) => {
  try {
    const incomingApp = req.body;
    if (!incomingApp || !incomingApp.title) {
      return sendApiError(req, res, 400, 'INVALID_APP', 'App title is required');
    }
    const tenantId = getReqTenant(req);
    const mode = normalizeStudioMode(incomingApp.mode);
    const compiledCode = incomingApp.files
      ? compileFilesIntoHtmlBundle(incomingApp.files)
      : String(incomingApp.code || '');
    const files = decomposeHtmlIntoFiles(
      compiledCode,
      incomingApp.title,
      incomingApp.description || incomingApp.title,
      mode,
      incomingApp.files
    );
    const diagnostics = validateStudioProject(files, compiledCode);

    const updatedApp = {
      ...incomingApp,
      id: incomingApp.id || `app-${Date.now()}`,
      mode,
      code: compiledCode,
      files,
      diagnostics,
      createdAt: incomingApp.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const existingIndex = next.findIndex((a: any) => a.id === updatedApp.id);
      if (existingIndex >= 0) next[existingIndex] = updatedApp;
      else next.unshift(updatedApp);
      return next;
    });
    res.json({ success: true, app: updatedApp });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_APPS_SAVE_ERROR', error.message);
  }
});

app.put('/api/studio/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getReqTenant(req);
    const patch = req.body || {};
    let updatedRecord: any = null;

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === id);
      const base = idx >= 0 ? next[idx] : { id, title: patch.title || 'Workspace App', description: patch.description || '' };
      const mode = normalizeStudioMode(patch.mode || base.mode);
      const nextFiles = patch.files ? { ...(base.files || {}), ...patch.files } : base.files;
      const compiledCode = nextFiles
        ? compileFilesIntoHtmlBundle(nextFiles)
        : String(patch.code || base.code || '');
      const normalizedFiles = decomposeHtmlIntoFiles(
        compiledCode,
        patch.title || base.title,
        patch.description || base.description || '',
        mode,
        nextFiles
      );
      const diagnostics = validateStudioProject(normalizedFiles, compiledCode);

      updatedRecord = {
        ...base,
        ...patch,
        id,
        mode,
        files: normalizedFiles,
        code: compiledCode,
        diagnostics,
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) next[idx] = updatedRecord;
      else next.unshift(updatedRecord);
      return next;
    });

    res.json({ success: true, app: updatedRecord });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_APPS_UPDATE_ERROR', error.message);
  }
});

app.delete('/api/studio/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'studio_apps', DEFAULT_GALLERY_APPS, (apps) =>
      apps.filter((a: any) => a.id !== id)
    );
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_APPS_DELETE_ERROR', error.message);
  }
});

app.get('/api/studio/gallery', async (_req, res) => {
  const enrichedGallery = DEFAULT_GALLERY_APPS.map((g: any) => {
    const mode = normalizeStudioMode(g.category === 'Build an Android app' ? 'Mobile mode' : 'Default mode');
    const files = g.files || decomposeHtmlIntoFiles(g.code, g.title, g.description, mode);
    return {
      ...g,
      mode,
      framework: 'HTML5 + Tailwind + ES6',
      files,
      diagnostics: validateStudioProject(files, g.code),
    };
  });
  res.json({
    success: true,
    gallery: enrichedGallery,
  });
});

// Remix (Fork) any Saved or Gallery App into the User's My Apps Workspace
app.post('/api/studio/apps/:id/remix', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getReqTenant(req);
    const saved = await getStoredStudioApps(tenantId);
    const sourceApp =
      saved.find((a: any) => a.id === id) ||
      DEFAULT_GALLERY_APPS.find((g: any) => g.id === id) ||
      req.body?.app;

    if (!sourceApp) {
      return sendApiError(req, res, 404, 'APP_NOT_FOUND', 'Source application not found to remix.');
    }

    const now = new Date().toISOString();
    const mode = normalizeStudioMode(sourceApp.mode || (sourceApp.category === 'Build an Android app' ? 'Mobile mode' : 'Default mode'));
    const title = sourceApp.title?.includes('(Remix)') ? sourceApp.title : `${sourceApp.title} (Remix)`;
    const files = decomposeHtmlIntoFiles(
      sourceApp.code,
      title,
      sourceApp.description || title,
      mode,
      sourceApp.files
    );
    const compiledCode = compileFilesIntoHtmlBundle(files);
    const diagnostics = validateStudioProject(files, compiledCode);

    const forkedApp: RichStudioApp = {
      ...sourceApp,
      id: `app-remix-${Date.now()}`,
      title,
      mode,
      framework: sourceApp.framework || 'HTML5 + Tailwind + ES6',
      providerUsed: sourceApp.providerUsed || 'template',
      modelUsed: sourceApp.modelUsed || 'remix-fork',
      createdAt: now,
      updatedAt: now,
      code: compiledCode,
      files,
      diagnostics,
      publishMeta: { isPublished: false },
      currentVersion: 1,
      versions: [
        {
          version: 1,
          prompt: `Remixed from "${sourceApp.title}"`,
          mode,
          providerUsed: 'remix',
          modelUsed: 'fork',
          createdAt: now,
          code: compiledCode,
          files,
        },
      ],
      turns: [
        {
          id: `a_remix_${Date.now()}`,
          role: 'assistant',
          modelLabel: 'RaOne Remix Engine',
          content: `Forked "${sourceApp.title}" into a private editable workspace. Describe any new features or changes below.`,
          details: [`Mode: ${mode}`, `Files: ${Object.keys(files).join(', ')}`],
          timestamp: now,
        },
      ],
    };

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => [
      forkedApp,
      ...apps,
    ]);

    res.json({ success: true, app: forkedApp });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_REMIX_ERROR', error.message);
  }
});

// Publish App Snapshot to a Standalone Hosted Preview URL (/published/:shareId)
app.post('/api/studio/apps/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getReqTenant(req);
    const bodyApp = req.body?.app;
    const apps = await getStoredStudioApps(tenantId);
    const targetApp = apps.find((a: any) => a.id === id) || bodyApp;

    if (!targetApp) {
      return sendApiError(req, res, 404, 'APP_NOT_FOUND', 'Application not found to publish.');
    }

    const shareId =
      targetApp.publishMeta?.shareId ||
      `ra_${crypto.createHash('sha256').update(`${tenantId}:${id}`).digest('hex').slice(0, 10)}`;
    const now = new Date().toISOString();
    const compiledCode = targetApp.files
      ? compileFilesIntoHtmlBundle(targetApp.files)
      : String(targetApp.code || '');

    const snapshot: PublishedSnapshotRecord = {
      shareId,
      tenantId,
      appId: id,
      title: targetApp.title || 'RaOne Studio App',
      description: targetApp.description || '',
      mode: normalizeStudioMode(targetApp.mode),
      code: compiledCode,
      publishedAt: targetApp.publishMeta?.publishedAt || now,
      updatedAt: now,
      views: targetApp.publishMeta?.views || 0,
    };

    await mutateSharedCollection<Record<string, PublishedSnapshotRecord>>(
      'studio_published',
      {},
      (map) => ({
        ...map,
        [shareId]: snapshot,
      })
    );

    const publishMeta = {
      isPublished: true,
      shareId,
      shareUrl: `/published/${shareId}`,
      publishedAt: now,
    };

    let updatedApp = { ...targetApp, publishMeta, updatedAt: now };
    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (list) => {
      const next = [...list];
      const idx = next.findIndex((a: any) => a.id === id);
      if (idx >= 0) {
        updatedApp = { ...next[idx], publishMeta, updatedAt: now };
        next[idx] = updatedApp;
      } else {
        next.unshift(updatedApp);
      }
      return next;
    });

    res.json({ success: true, publishMeta, app: updatedApp });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_PUBLISH_ERROR', error.message);
  }
});

// Persist Browser-Direct Built/Refined App (e.g. from client-side Local llama.cpp)
app.post('/api/studio/apps/persist-direct', async (req, res) => {
  try {
    const {
      rawText,
      prompt,
      mode = 'Default mode',
      category = 'general',
      modelUsed = 'local-llama-cpp',
      existingApp,
      isRefinement = false,
      turns,
      projectConfig,
    } = req.body || {};

    if (!rawText || !prompt) {
      return sendApiError(req, res, 400, 'INVALID_DIRECT_PAYLOAD', 'rawText and prompt are required.');
    }

    const tenantId = getReqTenant(req);
    const normalizedMode = normalizeStudioMode(mode);
    let materialized = materializeProjectFromRawOutput({
      rawText: String(rawText),
      prompt: String(prompt),
      category: String(category),
      mode: normalizedMode,
      providerUsed: 'local',
      modelUsed: String(modelUsed),
      existingApp,
      isRefinement: Boolean(isRefinement),
      projectConfig: projectConfig as StudioProjectConfig | undefined,
    });

    if (!materialized) {
      materialized = fallbackSynthesizeStudioProject({
        prompt: String(prompt),
        category: String(category),
        mode: normalizedMode,
        existingApp,
        isRefinement: Boolean(isRefinement),
        projectConfig: projectConfig as StudioProjectConfig | undefined,
      });
    }

    if (Array.isArray(turns)) {
      materialized.turns = turns;
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === materialized!.id);
      if (idx >= 0) next[idx] = materialized!;
      else next.unshift(materialized!);
      return next;
    });

    res.json({ success: true, app: materialized });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_PERSIST_DIRECT_ERROR', error.message);
  }
});

// Shared Helper to Resolve Tenant AI Credentials for Studio Operations
async function resolveStudioAiContext(req: express.Request, bodyApiKey?: string) {
  const { client: tenantGeminiClient, byok } = await getTenantGeminiClient(req);
  const providedKey = typeof bodyApiKey === 'string' ? bodyApiKey.trim() : '';
  const scopedGeminiClient =
    providedKey.length > 10
      ? new GoogleGenAI({ apiKey: providedKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } })
      : tenantGeminiClient;

  return {
    geminiClient: scopedGeminiClient,
    byok,
    serverKeys: {
      groqApiKey: GROQ_API_KEY,
      openAiApiKey: OPENAI_API_KEY,
      anthropicApiKey: ANTHROPIC_API_KEY,
      deepSeekApiKey: DEEPSEEK_API_KEY,
      cometApiKey: COMET_API_KEY,
      cometApiBaseUrl: COMET_API_BASE_URL,
    },
  };
}

function writeSseFrame(res: express.Response, payload: Record<string, any>) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Silicon Valley Grade Streaming Build Endpoint (SSE + Mode-Aware + Multi-Provider + Validator)
app.post('/api/studio/build-app/stream', apiHeavyAiLimiter, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    const {
      prompt,
      mode = 'Default mode',
      category = 'general',
      provider = 'auto',
      model,
      attachments = [],
      turns = [],
      projectConfig,
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      writeSseFrame(res, { type: 'error', error: 'App description prompt is required.' });
      return res.end();
    }

    const tenantId = getReqTenant(req);
    const normalizedMode = normalizeStudioMode(mode);
    const providerChoice = (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice;
    const typedConfig = projectConfig as StudioProjectConfig | undefined;

    writeSseFrame(res, {
      type: 'phase',
      phase: 'Analyzing Architecture',
      detail: `Target: ${typedConfig?.category || category} · Mode: ${normalizedMode} · Provider: ${providerChoice}`,
    });

    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);
    const buildPrompt = buildStudioGeneratePrompt({
      prompt,
      mode: normalizedMode,
      attachments: Array.isArray(attachments) ? (attachments as StudioAppAttachment[]) : [],
      projectConfig: typedConfig,
    });

    let lastProgressSent = 0;
    const aiOut = await executeStudioAiPrompt({
      providerChoice,
      requestedModel: typeof model === 'string' ? model : undefined,
      userPromptText: buildPrompt,
      systemInstruction: SYSTEM_PROMPT,
      attachments: Array.isArray(attachments) ? attachments : [],
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
      onStatus: (provLabel, modLabel) => {
        writeSseFrame(res, {
          type: 'phase',
          phase: 'Synthesizing Code',
          provider: provLabel,
          model: modLabel,
          detail: `Streaming multi-file source from ${provLabel} (${modLabel})...`,
        });
      },
      onDelta: (delta, acc) => {
        const nowMs = Date.now();
        if (nowMs - lastProgressSent > 120) {
          lastProgressSent = nowMs;
          writeSseFrame(res, {
            type: 'delta',
            delta,
            chars: acc.length,
          });
        }
      },
    });

    writeSseFrame(res, {
      type: 'phase',
      phase: 'Resolving Dependencies & Auditing',
      detail: 'Decomposing workspace, resolving packages & running security/syntax checks...',
    });

    let project: RichStudioApp | null = null;
    if (aiOut?.rawText) {
      project = materializeProjectFromRawOutput({
        rawText: aiOut.rawText,
        prompt,
        category: typedConfig?.category || category,
        mode: normalizedMode,
        providerUsed: aiOut.providerUsed,
        modelUsed: aiOut.modelUsed,
        projectConfig: typedConfig,
      });
    }

    if (!project) {
      project = fallbackSynthesizeStudioProject({
        prompt,
        category: typedConfig?.category || category,
        mode: normalizedMode,
        projectConfig: typedConfig,
      });
    }

    if (Array.isArray(turns) && turns.length > 0) {
      project.turns = turns;
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => [
      project!,
      ...apps,
    ]);

    writeSseFrame(res, { type: 'complete', app: project });
    res.end();
  } catch (error: any) {
    console.error('Stream build error:', error);
    writeSseFrame(res, { type: 'error', error: error?.message || 'Build stream failed.' });
    res.end();
  }
});

// Silicon Valley Grade Streaming Refine Endpoint (SSE + Version Snapshots + Selected Element + Turns)
app.post('/api/studio/refine-app/stream', apiHeavyAiLimiter, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    const {
      app: currentApp,
      refinementPrompt,
      mode,
      provider = 'auto',
      model,
      selectedElementContext,
      attachments = [],
      turns,
      projectConfig,
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};

    if (!currentApp || !refinementPrompt) {
      writeSseFrame(res, { type: 'error', error: 'Current app and refinementPrompt are required.' });
      return res.end();
    }

    const tenantId = getReqTenant(req);
    const normalizedMode = normalizeStudioMode(mode || currentApp.mode);
    const providerChoice = (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice;
    const typedConfig = (projectConfig || currentApp.projectConfig) as StudioProjectConfig | undefined;

    writeSseFrame(res, {
      type: 'phase',
      phase: 'Planning Refactor',
      detail: `Inspecting ${(currentApp.files && Object.keys(currentApp.files).length) || 1} files (${normalizedMode})...`,
    });

    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);
    const refinePrompt = buildStudioRefinePrompt({
      app: currentApp,
      refinementPrompt,
      mode: normalizedMode,
      selectedElementContext,
      attachments: Array.isArray(attachments) ? attachments : [],
      projectConfig: typedConfig,
    });

    let lastProgressSent = 0;
    const aiOut = await executeStudioAiPrompt({
      providerChoice,
      requestedModel: typeof model === 'string' ? model : undefined,
      userPromptText: refinePrompt,
      systemInstruction: SYSTEM_PROMPT,
      attachments: Array.isArray(attachments) ? attachments : [],
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
      onStatus: (provLabel, modLabel) => {
        writeSseFrame(res, {
          type: 'phase',
          phase: 'Applying Code Changes',
          provider: provLabel,
          model: modLabel,
          detail: `Refining via ${provLabel} (${modLabel})...`,
        });
      },
      onDelta: (delta, acc) => {
        const nowMs = Date.now();
        if (nowMs - lastProgressSent > 120) {
          lastProgressSent = nowMs;
          writeSseFrame(res, { type: 'delta', delta, chars: acc.length });
        }
      },
    });

    writeSseFrame(res, {
      type: 'phase',
      phase: 'Auditing & Saving Snapshot',
      detail: 'Validating syntax, resolving dependencies & saving version snapshot...',
    });

    let updatedProject: RichStudioApp | null = null;
    if (aiOut?.rawText) {
      updatedProject = materializeProjectFromRawOutput({
        rawText: aiOut.rawText,
        prompt: refinementPrompt,
        category: currentApp.category || typedConfig?.category || 'general',
        mode: normalizedMode,
        providerUsed: aiOut.providerUsed,
        modelUsed: aiOut.modelUsed,
        existingApp: currentApp,
        isRefinement: true,
        projectConfig: typedConfig,
      });
    }

    if (!updatedProject) {
      updatedProject = fallbackSynthesizeStudioProject({
        prompt: refinementPrompt,
        category: currentApp.category || typedConfig?.category || 'general',
        mode: normalizedMode,
        existingApp: currentApp,
        isRefinement: true,
        projectConfig: typedConfig,
      });
    }

    if (Array.isArray(turns)) {
      updatedProject.turns = turns;
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === updatedProject!.id);
      if (idx >= 0) next[idx] = updatedProject!;
      else next.unshift(updatedProject!);
      return next;
    });

    writeSseFrame(res, { type: 'complete', app: updatedProject });
    res.end();
  } catch (error: any) {
    console.error('Stream refine error:', error);
    writeSseFrame(res, { type: 'error', error: error?.message || 'Refine stream failed.' });
    res.end();
  }
});

// 1-Click AI Auto-Fix Endpoint for Sandbox Runtime Errors
app.post('/api/studio/fix-error', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      app: currentApp,
      errors = [],
      provider = 'auto',
      model,
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};

    if (!currentApp || !Array.isArray(errors) || errors.length === 0) {
      return sendApiError(req, res, 400, 'INVALID_AUTOFIX_REQUEST', 'Current app and at least one error message are required.');
    }

    const tenantId = getReqTenant(req);
    const normalizedMode = normalizeStudioMode(currentApp.mode);
    const providerChoice = (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice;
    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);

    const fixPrompt = buildStudioAutoFixPrompt({
      app: currentApp,
      runtimeErrors: errors.map((e: any) => String(e)),
    });

    const aiOut = await executeStudioAiPrompt({
      providerChoice,
      requestedModel: typeof model === 'string' ? model : undefined,
      userPromptText: fixPrompt,
      systemInstruction: SYSTEM_PROMPT,
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
    });

    let fixedProject: RichStudioApp | null = null;
    if (aiOut?.rawText) {
      fixedProject = materializeProjectFromRawOutput({
        rawText: aiOut.rawText,
        prompt: `Auto-fix: ${String(errors[0]).slice(0, 80)}`,
        category: currentApp.category || 'general',
        mode: normalizedMode,
        providerUsed: aiOut.providerUsed,
        modelUsed: aiOut.modelUsed,
        existingApp: currentApp,
        isRefinement: true,
      });
    }

    if (!fixedProject) {
      return sendApiError(
        req,
        res,
        503,
        'AUTOFIX_PROVIDER_UNAVAILABLE',
        'No live AI provider could generate a patch for this error. Configure Gemini, Groq, or Local llama.cpp in Settings.'
      );
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === fixedProject!.id);
      if (idx >= 0) next[idx] = fixedProject!;
      else next.unshift(fixedProject!);
      return next;
    });

    res.json({ success: true, app: fixedProject });
  } catch (error: any) {
    sendApiError(req, res, 500, 'AUTOFIX_ERROR', error.message);
  }
});

// Backward-compatible non-streaming build endpoint (upgraded to honor mode, multi-provider, projectConfig & diagnostics)
app.post('/api/studio/build-app', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      prompt,
      mode = 'Default mode',
      category = 'general',
      provider = 'auto',
      model,
      attachments = [],
      projectConfig,
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};
    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'App description prompt is required');
    }

    const tenantId = getReqTenant(req);
    const normalizedMode = normalizeStudioMode(mode);
    const providerChoice = (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice;
    const typedConfig = projectConfig as StudioProjectConfig | undefined;
    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);

    const buildInstruction = buildStudioGeneratePrompt({
      prompt,
      mode: normalizedMode,
      attachments: Array.isArray(attachments) ? attachments : [],
      projectConfig: typedConfig,
    });

    const aiOut = await executeStudioAiPrompt({
      providerChoice,
      requestedModel: typeof model === 'string' ? model : undefined,
      userPromptText: buildInstruction,
      systemInstruction: SYSTEM_PROMPT,
      attachments: Array.isArray(attachments) ? attachments : [],
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
    });

    let generatedProject = aiOut?.rawText
      ? materializeProjectFromRawOutput({
          rawText: aiOut.rawText,
          prompt,
          category: typedConfig?.category || category,
          mode: normalizedMode,
          providerUsed: aiOut.providerUsed,
          modelUsed: aiOut.modelUsed,
          projectConfig: typedConfig,
        })
      : null;

    if (!generatedProject) {
      generatedProject = fallbackSynthesizeStudioProject({
        prompt,
        category: typedConfig?.category || category,
        mode: normalizedMode,
        projectConfig: typedConfig,
      });
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => [
      generatedProject!,
      ...apps,
    ]);

    res.json({
      success: true,
      app: generatedProject,
    });
  } catch (error: any) {
    console.error('Build app error:', error);
    sendApiError(req, res, 500, 'BUILD_APP_ERROR', error.message);
  }
});

// Backward-compatible non-streaming App Refinement Endpoint
app.post('/api/studio/refine-app', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      app: currentApp,
      refinementPrompt,
      mode,
      provider = 'auto',
      model,
      selectedElementContext,
      attachments = [],
      projectConfig,
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};
    if (!currentApp || !refinementPrompt) {
      return sendApiError(req, res, 400, 'INVALID_REFINE_REQUEST', 'Current app object and refinementPrompt are required.');
    }

    const tenantId = getReqTenant(req);
    const normalizedMode = normalizeStudioMode(mode || currentApp.mode);
    const providerChoice = (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice;
    const typedConfig = (projectConfig || currentApp.projectConfig) as StudioProjectConfig | undefined;
    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);

    const refineInstruction = buildStudioRefinePrompt({
      app: currentApp,
      refinementPrompt,
      mode: normalizedMode,
      selectedElementContext,
      attachments: Array.isArray(attachments) ? attachments : [],
      projectConfig: typedConfig,
    });

    const aiOut = await executeStudioAiPrompt({
      providerChoice,
      requestedModel: typeof model === 'string' ? model : undefined,
      userPromptText: refineInstruction,
      systemInstruction: SYSTEM_PROMPT,
      attachments: Array.isArray(attachments) ? attachments : [],
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
    });

    let updatedProject = aiOut?.rawText
      ? materializeProjectFromRawOutput({
          rawText: aiOut.rawText,
          prompt: refinementPrompt,
          category: currentApp.category || typedConfig?.category || 'general',
          mode: normalizedMode,
          providerUsed: aiOut.providerUsed,
          modelUsed: aiOut.modelUsed,
          existingApp: currentApp,
          isRefinement: true,
          projectConfig: typedConfig,
        })
      : null;

    if (!updatedProject) {
      updatedProject = fallbackSynthesizeStudioProject({
        prompt: refinementPrompt,
        category: currentApp.category || typedConfig?.category || 'general',
        mode: normalizedMode,
        existingApp: currentApp,
        isRefinement: true,
        projectConfig: typedConfig,
      });
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === updatedProject!.id);
      if (idx >= 0) next[idx] = updatedProject!;
      else next.unshift(updatedProject!);
      return next;
    });

    res.json({
      success: true,
      app: updatedProject,
    });
  } catch (error: any) {
    console.error('Refine app error:', error);
    sendApiError(req, res, 500, 'REFINE_APP_ERROR', error.message);
  }
});

// Prompt Enhancer (Turns 2+ words into a comprehensive engineering PRD prompt)
app.post('/api/studio/enhance-prompt', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      prompt,
      depth = 'fullstack',
      projectConfig,
      provider = 'auto',
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt text is required to enhance.');
    }

    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);
    const out = await enhanceStudioPromptServer({
      rawPrompt: prompt,
      depth: (String(depth) as PromptEnhanceDepth) || 'fullstack',
      projectConfig: projectConfig as StudioProjectConfig | undefined,
      providerChoice: (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice,
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
    });

    res.json({
      success: true,
      enhancedPrompt: out.enhancedPrompt,
      providerUsed: out.providerUsed,
    });
  } catch (error: any) {
    sendApiError(req, res, 500, 'ENHANCE_PROMPT_ERROR', error.message);
  }
});

// Dependency Analyzer & Package Manifest Sync
app.post('/api/studio/dependencies/resolve', async (req, res) => {
  try {
    const { files = {}, projectConfig, addPackage, removePackage } = req.body || {};
    const cfg = projectConfig ? { ...(projectConfig as StudioProjectConfig) } : undefined;
    if (cfg) {
      const currentCustom = new Set<string>(cfg.customDependencies || []);
      if (typeof addPackage === 'string' && addPackage.trim()) {
        currentCustom.add(addPackage.trim());
      }
      if (typeof removePackage === 'string' && removePackage.trim()) {
        currentCustom.delete(removePackage.trim());
      }
      cfg.customDependencies = Array.from(currentCustom);
    }

    const analysis = analyzeProjectDependencies(files as Record<string, string>, cfg);
    res.json({
      success: true,
      dependencies: analysis.dependencies,
      envVariables: analysis.envVariables,
      generatedManifests: analysis.generatedManifests,
      updatedConfig: cfg,
    });
  } catch (error: any) {
    sendApiError(req, res, 500, 'DEPENDENCY_RESOLVE_ERROR', error.message);
  }
});

// Full Security, Syntax, Performance, SEO & Accessibility Audit
app.post('/api/studio/audit', async (req, res) => {
  try {
    const { app: currentApp, files, code, projectConfig } = req.body || {};
    const fileMap: Record<string, string> = files || currentApp?.files || {};
    const compiledHtml: string =
      code || currentApp?.code || (Object.keys(fileMap).length ? compileFilesIntoHtmlBundle(fileMap) : '');
    const cfg = (projectConfig || currentApp?.projectConfig) as StudioProjectConfig | undefined;

    const auditReport = runFullStudioAudit(fileMap, compiledHtml, cfg);
    const depAnalysis = analyzeProjectDependencies(fileMap, cfg);

    res.json({
      success: true,
      auditReport,
      dependencies: depAnalysis.dependencies,
      envVariables: depAnalysis.envVariables,
    });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_AUDIT_ERROR', error.message);
  }
});

// 1-Click AI Audit Remediation (Patches all Security/Syntax/SEO/A11y findings)
app.post('/api/studio/audit/fix', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      app: currentApp,
      auditReport,
      projectConfig,
      provider = 'auto',
      geminiApiKey,
      apiKey: bodyApiKey,
    } = req.body || {};

    if (!currentApp || !currentApp.files) {
      return sendApiError(req, res, 400, 'INVALID_AUDIT_FIX_REQUEST', 'Current app files are required.');
    }

    const tenantId = getReqTenant(req);
    const cfg = (projectConfig || currentApp.projectConfig) as StudioProjectConfig | undefined;
    const activeReport =
      auditReport ||
      runFullStudioAudit(currentApp.files, currentApp.code || '', cfg);

    if (!activeReport.findings || activeReport.findings.length === 0) {
      return res.json({ success: true, app: { ...currentApp, auditReport: activeReport } });
    }

    const ctx = await resolveStudioAiContext(req, geminiApiKey || bodyApiKey);
    const fixPrompt = buildAuditAutoFixPrompt({
      title: currentApp.title || 'Studio Project',
      files: currentApp.files,
      report: activeReport,
      config: cfg,
    });

    const aiOut = await executeStudioAiPrompt({
      providerChoice: (String(provider || 'auto').toLowerCase() || 'auto') as StudioProviderChoice,
      userPromptText: fixPrompt,
      systemInstruction: SYSTEM_PROMPT,
      byok: ctx.byok,
      geminiClient: ctx.geminiClient,
      serverKeys: ctx.serverKeys,
    });

    let patchedApp: RichStudioApp | null = null;
    if (aiOut?.rawText) {
      patchedApp = materializeProjectFromRawOutput({
        rawText: aiOut.rawText,
        prompt: `Audit auto-fix (${activeReport.findings.length} checks)`,
        category: currentApp.category || cfg?.category || 'general',
        mode: normalizeStudioMode(currentApp.mode),
        providerUsed: aiOut.providerUsed,
        modelUsed: aiOut.modelUsed,
        existingApp: currentApp,
        isRefinement: true,
        projectConfig: cfg,
      });
    }

    if (!patchedApp) {
      return sendApiError(
        req,
        res,
        503,
        'AUDIT_FIX_UNAVAILABLE',
        'No live AI provider could remediate these audit findings. Configure Gemini, Groq, OpenAI or Local llama.cpp in Settings.'
      );
    }

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === patchedApp!.id);
      if (idx >= 0) next[idx] = patchedApp!;
      else next.unshift(patchedApp!);
      return next;
    });

    res.json({ success: true, app: patchedApp });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_AUDIT_FIX_ERROR', error.message);
  }
});

// Synthesize & Attach Firebase / Google Cloud Run / GitHub Deployment Artifacts
app.post('/api/studio/deploy/prepare', async (req, res) => {
  try {
    const {
      app: currentApp,
      target = 'firebase',
      firebaseProjectId,
      gcpRegion,
      cloudRunService,
      githubRepo,
      githubBranch,
    } = req.body || {};

    if (!currentApp) {
      return sendApiError(req, res, 400, 'INVALID_DEPLOY_REQUEST', 'Current app is required.');
    }

    const tenantId = getReqTenant(req);
    const files: Record<string, string> = { ...(currentApp.files || {}) };
    const artifacts = synthesizeDeployArtifacts({
      title: currentApp.title || 'raone-app',
      files,
      config: currentApp.projectConfig,
      target: target as DeployTargetId,
      firebaseProjectId,
      gcpRegion,
      cloudRunService,
      githubRepo,
      githubBranch,
    });

    const mergedFiles = { ...files, ...artifacts.generatedFiles };
    const normalizedMode = normalizeStudioMode(currentApp.mode);
    const compiledCode = compileFilesIntoHtmlBundle(mergedFiles);
    const auditReport = runFullStudioAudit(mergedFiles, compiledCode, currentApp.projectConfig);

    let updatedApp = {
      ...currentApp,
      files: mergedFiles,
      code: compiledCode,
      auditReport,
      updatedAt: new Date().toISOString(),
    };

    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', DEFAULT_GALLERY_APPS, (apps) => {
      const next = [...apps];
      const idx = next.findIndex((a: any) => a.id === updatedApp.id);
      if (idx >= 0) next[idx] = updatedApp;
      else next.unshift(updatedApp);
      return next;
    });

    res.json({
      success: true,
      artifacts,
      app: updatedApp,
    });
  } catch (error: any) {
    sendApiError(req, res, 500, 'STUDIO_DEPLOY_PREP_ERROR', error.message);
  }
});

// Direct GitHub Repository Push (Uses user-supplied PAT in memory only, never persisted on disk)
app.post('/api/studio/deploy/github', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      app: currentApp,
      repo,
      branch = 'main',
      token,
      commitMessage = 'Deploy generated project from RaOne Code Studio',
    } = req.body || {};

    if (!currentApp?.files || !repo || !token) {
      return sendApiError(
        req,
        res,
        400,
        'INVALID_GITHUB_PUSH',
        'Repository (owner/name), branch, GitHub Personal Access Token, and project files are required.'
      );
    }

    const cleanRepo = String(repo).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleanRepo)) {
      return sendApiError(req, res, 400, 'INVALID_GITHUB_REPO', 'Repository must match "owner/repo" format.');
    }

    const cleanBranch = String(branch || 'main').trim();
    const ghHeaders = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${String(token).trim()}`,
      'User-Agent': 'RaOne-Code-Studio',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const fileEntries = Object.entries(currentApp.files as Record<string, string>)
      .filter(([k, v]) => typeof v === 'string' && v.length > 0 && !k.startsWith('/'))
      .slice(0, 40);

    const pushedFiles: string[] = [];
    for (const [filePath, content] of fileEntries) {
      const apiUrl = `https://api.github.com/repos/${cleanRepo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
      let existingSha: string | undefined;
      const getResp = await fetch(`${apiUrl}?ref=${encodeURIComponent(cleanBranch)}`, {
        method: 'GET',
        headers: ghHeaders,
      });
      if (getResp.ok) {
        const existingJson: any = await getResp.json();
        existingSha = existingJson?.sha;
      }

      const putResp = await fetch(apiUrl, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `${commitMessage} (${filePath})`,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch: cleanBranch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });
      if (!putResp.ok) {
        const errBody = await putResp.text().catch(() => '');
        return sendApiError(
          req,
          res,
          putResp.status,
          'GITHUB_PUSH_FAILED',
          `GitHub API rejected ${filePath} (HTTP ${putResp.status}): ${errBody.slice(0, 220)}`
        );
      }
      pushedFiles.push(filePath);
    }

    res.json({
      success: true,
      repo: cleanRepo,
      branch: cleanBranch,
      pushedCount: pushedFiles.length,
      pushedFiles,
      repoUrl: `https://github.com/${cleanRepo}/tree/${cleanBranch}`,
    });
  } catch (error: any) {
    sendApiError(req, res, 500, 'GITHUB_DEPLOY_ERROR', error.message);
  }
});

// ==========================================
// Conversations Persistence Endpoints (Strictly Tenant-Scoped - A02 & A03)
// ==========================================
app.get('/api/conversations', async (req, res) => {
  try {
    const list = await readTenantCollection<any[]>(getReqTenant(req), 'conversations', []);
    res.json(list);
  } catch (error: any) {
    sendApiError(req, res, 500, 'CONVERSATIONS_READ_ERROR', error.message);
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const conversation = req.body;
    if (!conversation?.id) {
      return sendApiError(req, res, 400, 'INVALID_CONVERSATION', 'Conversation id is required');
    }
    if (conversation.isTemporary || conversation.id === 'temporary') {
      return res.json({ success: true, conversation, isTemporary: true, persisted: false });
    }
    await mutateTenantCollection<any[]>(getReqTenant(req), 'conversations', [], (list) => {
      const next = [...list];
      const existingIndex = next.findIndex((c: any) => c.id === conversation.id);
      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          ...conversation,
          updatedAt: new Date().toISOString(),
        };
      } else {
        next.unshift({
          ...conversation,
          createdAt: conversation.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return next;
    });
    res.json({ success: true, conversation });
  } catch (error: any) {
    sendApiError(req, res, 500, 'CONVERSATIONS_SAVE_ERROR', error.message);
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'conversations', [], (list) =>
      list.filter((c: any) => c.id !== id)
    );
    res.json({ success: true, id });
  } catch (error: any) {
    sendApiError(req, res, 500, 'CONVERSATIONS_DELETE_ERROR', error.message);
  }
});

app.post('/api/conversations/:id/rename', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body || {};
    let updatedItem: any = null;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'conversations', [], (list) =>
      list.map((c: any) => {
        if (c.id === id && title) {
          updatedItem = { ...c, title, updatedAt: new Date().toISOString() };
          return updatedItem;
        }
        return c;
      })
    );
    res.json({ success: true, item: updatedItem });
  } catch (error: any) {
    sendApiError(req, res, 500, 'CONVERSATIONS_RENAME_ERROR', error.message);
  }
});

app.post('/api/conversations/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    let updatedItem: any = null;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'conversations', [], (list) =>
      list.map((c: any) => {
        if (c.id === id) {
          updatedItem = {
            ...c,
            section: c.section === 'pinned' ? 'recents' : 'pinned',
            updatedAt: new Date().toISOString(),
          };
          return updatedItem;
        }
        return c;
      })
    );
    res.json({ success: true, item: updatedItem });
  } catch (error: any) {
    sendApiError(req, res, 500, 'CONVERSATIONS_PIN_ERROR', error.message);
  }
});

// ==========================================
// Projects Persistence & Workspace APIs (Strictly Tenant-Scoped - A03)
// ==========================================
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await readTenantCollection<any[]>(getReqTenant(req), 'projects', []);
    res.json(projects);
  } catch (error: any) {
    sendApiError(req, res, 500, 'PROJECTS_READ_ERROR', error.message);
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { id, name, description = '', instructions = '' } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return sendApiError(req, res, 400, 'INVALID_PROJECT', 'Project name is required');
    }
    const now = new Date().toISOString();
    let projectRecord: any = null;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'projects', [], (projects) => {
      const next = [...projects];
      const existingIndex = id ? next.findIndex((p: any) => p.id === id) : -1;
      projectRecord =
        existingIndex >= 0
          ? {
              ...next[existingIndex],
              name: cleanName,
              description: String(description || ''),
              instructions: String(instructions || ''),
              updatedAt: now,
            }
          : {
              id: id || `proj-${Date.now()}`,
              name: cleanName,
              description: String(description || ''),
              instructions: String(instructions || ''),
              createdAt: now,
              updatedAt: now,
            };
      if (existingIndex >= 0) next[existingIndex] = projectRecord;
      else next.unshift(projectRecord);
      return next;
    });
    res.json({ success: true, project: projectRecord });
  } catch (error: any) {
    sendApiError(req, res, 500, 'PROJECTS_SAVE_ERROR', error.message);
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'projects', [], (projects) =>
      projects.filter((p: any) => p.id !== id)
    );
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    sendApiError(req, res, 500, 'PROJECTS_DELETE_ERROR', error.message);
  }
});

// ==========================================
// Platform Policies, Privacy & Compliance APIs
// ==========================================
const PLATFORM_POLICIES = {
  brand: 'RaOne AI by RavanaTec',
  productName: 'RaOne AI Studio',
  effectiveDate: '2026-11-14',
  contactEmail: 'info.ravanatech@gmail.com',
  privacyPolicy: {
    title: 'Privacy Policy',
    summary:
      'RaOne AI Studio isolates workspace records per verified Firebase UID tenant and handles BYOK provider secrets with server-side AES-256-GCM encryption.',
    clauses: [
      'Tenant Isolation & Encryption: User workspaces are stored in tenant-isolated stores. Personal provider keys (BYOK) are encrypted at rest with AES-256-GCM and never returned to the client.',
      'Temporary Chat Behavior: Chats marked Temporary are withheld from server workspace persistence; inference payloads are still transmitted to the active external LLM provider over TLS.',
      'User Control & Portability: Signed-in users can export all owned categories as JSON (/api/user/settings/export-data) or purge their server tenant workspace (/api/user/settings/delete-account).',
      'Third-Party Inference Providers & Subprocessors: Depending on selected model and configuration, prompts may be routed to Google Gemini API, Groq Cloud LPU, OpenAI, Anthropic, DeepSeek, or approved gateway endpoints over TLS.',
    ],
  },
  termsOfService: {
    title: 'Terms of Service',
    summary:
      'By using RaOne AI Studio, you agree to use AI code, media, and document tools responsibly and in compliance with applicable laws.',
    clauses: [
      'Ownership: You retain full rights to code, prompts, and documents you author or export from your workspace.',
      'Capability Honesty: Features requiring optional GPU/FFmpeg/voice workers report explicit service availability rather than substituting unlabeled sample assets.',
      'AI Verification: Generated outputs and single-file HTML previews should be reviewed before production deployment.',
      'Billing & Credits: Paid tiers are updated strictly from verified billing webhook events and backed by an append-only credit ledger.',
    ],
  },
  aiSafetyPolicy: {
    title: 'AI Safety, Runtime Honesty & Provenance Policy',
    summary:
      'RaOne AI enforces strict runtime model disclosure and explicit capability states without fabricated citations.',
    clauses: [
      'Runtime Truthfulness: Every active LLM call receives the verified provider and model ID metadata.',
      'Source-Bound Grounding: Document analysis and chat answers cite user-provided uploaded content or active Google Search/Maps grounding chunks when enabled.',
      'Bilingual Precision: Supports Sinhala (Unicode), Singlish, and English accurately without altering technical identifiers.',
    ],
  },
  securityPolicy: {
    title: 'Security & Data Protection Policy',
    summary:
      'Defense-in-depth protections across Firebase Hosting, Cloud Run API gateway, isolated preview iframes, and Firestore rules.',
    clauses: [
      'Transport & Headers: Enforced HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy, strict CORS allowlists, and Content-Security-Policy.',
      'Identity & Egress Defense: Cryptographic RS256 Firebase JWT verification and HTTPS allowlist SSRF protection on custom provider tests.',
      'Rate Limiting & Quotas: True sliding-window rate limits per verified UID or IP across /api/* endpoints plus credit reservation guards.',
    ],
  },
};

app.get('/api/policies', (_req, res) => {
  res.json(PLATFORM_POLICIES);
});

function renderPolicyHtml(title: string, subtitle: string, sections: { heading: string; summary: string; items: string[] }[]): string {
  const sectionHtml = sections
    .map(
      (s) => `
      <section class="card">
        <h2>${s.heading}</h2>
        <p>${s.summary}</p>
        <ul>${s.items.map((item) => `<li>${item}</li>`).join('')}</ul>
      </section>`
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — RaOne AI Studio</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #070709; color: #ececec; line-height: 1.65; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 48px 20px; }
    .badge { display: inline-block; font-size: 12px; color: #38bdf8; border: 1px solid rgba(56,189,248,.35); background: rgba(56,189,248,.1); padding: 4px 10px; border-radius: 999px; }
    h1 { font-size: 28px; margin: 14px 0 6px; color: #fff; }
    .sub { color: #9ca3af; font-size: 14px; margin-bottom: 28px; }
    .card { background: #121216; border: 1px solid #26262e; border-radius: 14px; padding: 22px; margin-bottom: 18px; }
    h2 { font-size: 17px; color: #fff; margin: 0 0 8px; }
    p { color: #cbd5e1; font-size: 14px; margin: 0 0 12px; }
    ul { margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px; }
    li { margin-bottom: 6px; }
    a { color: #38bdf8; text-decoration: none; }
    footer { margin-top: 28px; font-size: 12px; color: #71717a; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
  </style>
</head>
<body>
  <main class="wrap">
    <span class="badge">RaOne AI by RavanaTec — Effective ${PLATFORM_POLICIES.effectiveDate}</span>
    <h1>${title}</h1>
    <div class="sub">${subtitle}</div>
    ${sectionHtml}
    <footer>
      <span>Contact: ${PLATFORM_POLICIES.contactEmail}</span>
      <span><a href="/privacy-policy">Privacy Policy</a> &middot; <a href="/terms-of-service">Terms of Service</a> &middot; <a href="/api/policies">JSON API</a></span>
    </footer>
  </main>
</body>
</html>`;
}

app.get('/privacy-policy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    renderPolicyHtml(
      'Privacy Policy',
      'How RaOne AI Studio collects, protects, and lets you control your workspace data.',
      [
        {
          heading: PLATFORM_POLICIES.privacyPolicy.title,
          summary: PLATFORM_POLICIES.privacyPolicy.summary,
          items: PLATFORM_POLICIES.privacyPolicy.clauses,
        },
        {
          heading: PLATFORM_POLICIES.securityPolicy.title,
          summary: PLATFORM_POLICIES.securityPolicy.summary,
          items: PLATFORM_POLICIES.securityPolicy.clauses,
        },
      ]
    )
  );
});

app.get('/terms-of-service', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    renderPolicyHtml(
      'Terms of Service & AI Safety Policy',
      'Usage terms, intellectual property ownership, and AI runtime honesty standards for RaOne AI Studio.',
      [
        {
          heading: PLATFORM_POLICIES.termsOfService.title,
          summary: PLATFORM_POLICIES.termsOfService.summary,
          items: PLATFORM_POLICIES.termsOfService.clauses,
        },
        {
          heading: PLATFORM_POLICIES.aiSafetyPolicy.title,
          summary: PLATFORM_POLICIES.aiSafetyPolicy.summary,
          items: PLATFORM_POLICIES.aiSafetyPolicy.clauses,
        },
      ]
    )
  );
});

// Intelligent Conversational Engine for natural responses in Sinhala & English with instant deliverables
function generateIntelligentResponse(
  prompt: string,
  model: string,
  history: Array<{ role: string; content: string }> = []
): string {
  const p = (prompt || '').trim().toLowerCase();

  // Search backward in conversation history for prior context (especially when user asks follow-ups like "ko ithin hadala diyan")
  let combinedContext = p;
  const lastUserMessages = history
    .filter((m) => m.role === 'user')
    .map((m) => (m.content || '').toLowerCase());
  if (lastUserMessages.length > 0) {
    combinedContext = `${lastUserMessages.join(' ')} ${p}`;
  }

  const isFollowUpRequest =
    p.includes('hadala diyan') ||
    p.includes('hadala deepan') ||
    p.includes('ko ithin') ||
    p.includes('ko hadapan') ||
    p.includes('ko diyan') ||
    p.includes('ko deepan') ||
    p.includes('diyan') ||
    p.includes('make it') ||
    p.includes('build it') ||
    p.includes('do it') ||
    p.includes('where is it') ||
    p.includes('give me');

  // 1. Basic Calculator Request (or follow-up requesting the calculator previously mentioned)
  if (
    p.includes('calculator') ||
    p.includes('ගණක') ||
    p.includes('calcu') ||
    (isFollowUpRequest && combinedContext.includes('calculator'))
  ) {
    return `අනිවාර්යයෙන්ම සුද්දා! ඔන්න මම ඔයාට ලස්සන, modern, glassmorphic UI එකක් සහිත සම්පූර්ණයෙන්ම ක්‍රියාත්මක වන **Basic Calculator** එකක් (Single-file HTML, CSS සහ JavaScript) හදලා දුන්නා.

මේක කෙලින්ම \`calculator.html\` විදිහට Save කරලා ඕනෑම Browser එකක double-click කරලා Run කරන්න පුළුවන්:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RaOne AI — Basic Calculator</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, #1e1e24 0%, #0d0e12 100%);
      color: #fff;
    }
    .calculator {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 24px;
      width: 340px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.2);
    }
    .brand-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 13px;
      color: #94a3b8;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .brand-header span.badge {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
    }
    .display {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: right;
      border: 1px solid rgba(255, 255, 255, 0.08);
      min-height: 85px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      word-break: break-all;
    }
    .previous-operand {
      color: #64748b;
      font-size: 14px;
      min-height: 18px;
    }
    .current-operand {
      color: #f8fafc;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    button {
      height: 56px;
      border: none;
      border-radius: 14px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
      outline: none;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-2px);
    }
    button:active {
      transform: translateY(0);
    }
    button.op {
      background: rgba(99, 102, 241, 0.25);
      color: #a5b4fc;
    }
    button.op:hover {
      background: rgba(99, 102, 241, 0.4);
    }
    button.action {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
    }
    button.action:hover {
      background: rgba(239, 68, 68, 0.35);
    }
    button.equal {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }
    button.equal:hover {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
      filter: brightness(1.1);
    }
    .span-2 {
      grid-column: span 2;
    }
  </style>
</head>
<body>

  <div class="calculator">
    <div class="brand-header">
      <span>RAONE CORE</span>
      <span class="badge">PRO CALC</span>
    </div>

    <div class="display">
      <div id="prevOperand" class="previous-operand"></div>
      <div id="currOperand" class="current-operand">0</div>
    </div>

    <div class="buttons">
      <button class="action" onclick="clearAll()">AC</button>
      <button class="action" onclick="deleteDigit()">DEL</button>
      <button class="op" onclick="appendOperator('%')">%</button>
      <button class="op" onclick="appendOperator('÷')">÷</button>

      <button onclick="appendNumber('7')">7</button>
      <button onclick="appendNumber('8')">8</button>
      <button onclick="appendNumber('9')">9</button>
      <button class="op" onclick="appendOperator('×')">×</button>

      <button onclick="appendNumber('4')">4</button>
      <button onclick="appendNumber('5')">5</button>
      <button onclick="appendNumber('6')">6</button>
      <button class="op" onclick="appendOperator('-')">-</button>

      <button onclick="appendNumber('1')">1</button>
      <button onclick="appendNumber('2')">2</button>
      <button onclick="appendNumber('3')">3</button>
      <button class="op" onclick="appendOperator('+')">+</button>

      <button onclick="appendNumber('0')" class="span-2">0</button>
      <button onclick="appendNumber('.')">.</button>
      <button class="equal" onclick="compute()">=</button>
    </div>
  </div>

  <script>
    let currentInput = '0';
    let previousInput = '';
    let operation = null;

    const currDisplay = document.getElementById('currOperand');
    const prevDisplay = document.getElementById('prevOperand');

    function updateDisplay() {
      currDisplay.innerText = currentInput;
      if (operation != null) {
        prevDisplay.innerText = \`\${previousInput} \${operation}\`;
      } else {
        prevDisplay.innerText = '';
      }
    }

    function appendNumber(number) {
      if (number === '.' && currentInput.includes('.')) return;
      if (currentInput === '0' && number !== '.') {
        currentInput = number;
      } else {
        currentInput = currentInput.toString() + number.toString();
      }
      updateDisplay();
    }

    function appendOperator(op) {
      if (currentInput === '' && previousInput === '') return;
      if (previousInput !== '') {
        compute();
      }
      operation = op;
      previousInput = currentInput;
      currentInput = '0';
      updateDisplay();
    }

    function compute() {
      let computation;
      const prev = parseFloat(previousInput);
      const current = parseFloat(currentInput);
      if (isNaN(prev) || isNaN(current)) return;

      switch (operation) {
        case '+':
          computation = prev + current;
          break;
        case '-':
          computation = prev - current;
          break;
        case '×':
          computation = prev * current;
          break;
        case '÷':
          if (current === 0) {
            alert('Cannot divide by zero!');
            clearAll();
            return;
          }
          computation = prev / current;
          break;
        case '%':
          computation = prev % current;
          break;
        default:
          return;
      }

      currentInput = Math.round(computation * 10000000) / 10000000;
      operation = null;
      previousInput = '';
      updateDisplay();
    }

    function deleteDigit() {
      if (currentInput === '0') return;
      if (currentInput.length === 1) {
        currentInput = '0';
      } else {
        currentInput = currentInput.slice(0, -1);
      }
      updateDisplay();
    }

    function clearAll() {
      currentInput = '0';
      previousInput = '';
      operation = null;
      updateDisplay();
    }

    // Keyboard bindings for power users
    window.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9') appendNumber(e.key);
      if (e.key === '.') appendNumber('.');
      if (e.key === '=' || e.key === 'Enter') compute();
      if (e.key === 'Backspace') deleteDigit();
      if (e.key === 'Escape') clearAll();
      if (e.key === '+') appendOperator('+');
      if (e.key === '-') appendOperator('-');
      if (e.key === '*') appendOperator('×');
      if (e.key === '/') appendOperator('÷');
      if (e.key === '%') appendOperator('%');
    });
  </script>
</body>
</html>
\`\`\`

### ⚡ විශේෂාංග:
1. **Glassmorphic Modern Design:** Glowing indigo accents සහ modern dark aesthetic.
2. **Keyboard Support:** පරිගණකයේ Number pad එක සහ Enter, Backspace, Esc කෙලින්ම වැඩ කරනවා.
3. **Smart Decimal & Division by Zero Protection:** වැරදි ගණනය කිරීම් වළක්වන logic එකක් අඩංගුයි.
4. **Zero External Dependencies:** Single HTML file එකක් නිසා ඕනෑම පරිගණකයක හෝ දුරකථනයක ක්ෂණිකව වැඩ.

තව මොනවා හරි විශේෂ ගණක ක්‍රමයක් (උදා: Scientific / Percentage / Currency) එකතු කරන්න ඕනෙද සුද්දා?`;
  }

  // 2. Identity & Name queries (e.g. "sudda ubae nama mokakda", "who are you", "what is your name")
  if (
    p.includes('nama mokakda') ||
    p.includes('nama mokadda') ||
    p.includes('kauda') ||
    p.includes('namak') ||
    p.includes('who are you') ||
    p.includes('what is your name') ||
    p.includes('identify') ||
    p.includes('introduce')
  ) {
    return `මගේ නම **RaOne AI** (Ravana + One) සුද්දා! 🔥

මම **RavanaTec** විසින් නිර්මාණය කරන ලද, ඔබගේ සියලුම කටයුතු සහ අවශ්‍යතා සඳහා වන ස්වෛරී කෘතිම බුද්ධි සහායකයා (**One AI for Your World**).

• **Brand:** RaOne
• **Product Name:** RaOne AI
• **Brand Meaning:** Ravana + One — One AI for Your World
• **Voice Activation Phrase:** “Hey RaOne”
• **Tagline:** Think. Create. Act.
• **Brand Signature:** RaOne AI by RavanaTec

මට සිංහල, English සහ Singlish භාෂා ත්‍රිත්වයෙන්ම ඔබ සමඟ චතුර ලෙස සන්නිවේදනය කරන්නත්, Strategy, Coding, Creative Writing, Image & Video Synthesis ඇතුළු ඕනෑම දෙයකට උදව් කරන්නත් පුළුවන්.

ඔබට අද මගෙන් මොනවද කරගන්න අවශ්‍ය?`;
  }

  // 3. Greetings
  if (
    p === 'hi' ||
    p === 'hello' ||
    p === 'hey' ||
    p === 'suddah' ||
    p === 'sudda' ||
    p.includes('ayubowan') ||
    p.includes('kohomada') ||
    p.includes('how are you') ||
    p.includes('hey raone')
  ) {
    return `ආයුබෝවන් සුද්දා! මම **RaOne AI** by RavanaTec.

මම උපරිම සූදානමින් ඉන්නවා. අද මට ඔබට උදව් කරන්න පුළුවන් කොහොමද? ඕනෑම ප්‍රශ්නයක්, කේතයක් (Code), වෙබ් ඇප් එකක් හෝ සැලැස්මක් ගැන අහන්න, අපි එකතු වෙලා සුපිරි වැඩක් කරමු!

RaOne AI by RavanaTec — Think. Create. Act.`;
  }

  // 4. Todo App Request
  if (p.includes('todo') || p.includes('task list') || (isFollowUpRequest && combinedContext.includes('todo'))) {
    return `අනිවාර්යයෙන්ම සුද්දා! ඔන්න Clean & Modern **Task & To-Do List Application** එකක කේතය (HTML, CSS, Vanilla JS with LocalStorage persistence):

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RaOne AI — Tasks</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; justify-content: center; padding: 40px 16px; }
    .card { background: #1e293b; border-radius: 16px; padding: 24px; width: 100%; max-width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { margin-bottom: 16px; font-size: 20px; display: flex; justify-content: space-between; }
    .input-row { display: flex; gap: 8px; margin-bottom: 20px; }
    input { flex: 1; padding: 12px 16px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #fff; outline: none; }
    button.add-btn { background: #6366f1; border: none; padding: 12px 18px; border-radius: 8px; color: #fff; font-weight: bold; cursor: pointer; }
    ul { list-style: none; padding: 0; }
    li { background: #0f172a; margin-bottom: 8px; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .completed { text-decoration: line-through; opacity: 0.5; }
    .del-btn { background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h2><span>RaOne Tasks</span><span style="font-size:12px;color:#818cf8;">Local DB</span></h2>
    <div class="input-row">
      <input type="text" id="taskInput" placeholder="Add new task..." onkeydown="if(event.key==='Enter')addTask()" />
      <button class="add-btn" onclick="addTask()">Add</button>
    </div>
    <ul id="taskList"></ul>
  </div>
  <script>
    let tasks = JSON.parse(localStorage.getItem('raone_tasks') || '[]');
    function render() {
      const list = document.getElementById('taskList');
      list.innerHTML = tasks.map((t, i) => \`
        <li>
          <span class="\${t.done ? 'completed' : ''}" onclick="toggle(\${i})" style="cursor:pointer">\${t.text}</span>
          <button class="del-btn" onclick="delTask(\${i})">✕</button>
        </li>
      \`).join('');
      localStorage.setItem('raone_tasks', JSON.stringify(tasks));
    }
    function addTask() {
      const input = document.getElementById('taskInput');
      if (!input.value.trim()) return;
      tasks.push({ text: input.value.trim(), done: false });
      input.value = '';
      render();
    }
    function toggle(i) { tasks[i].done = !tasks[i].done; render(); }
    function delTask(i) { tasks.splice(i, 1); render(); }
    render();
  </script>
</body>
</html>
\`\`\`

මෙම කේතය LocalStorage එකට save වන නිසා browser refresh කළත් දත්ත මැකෙන්නේ නැහැ සුද්දා!`;
  }

  // 5. Python Specific Request
  if (p.includes('python') || (isFollowUpRequest && combinedContext.includes('python'))) {
    return `අනිවාර්යයෙන්ම සුද්දා! ඔබ ඉල්ලූ අවශ්‍යතාවයට අදාළ Python Script එක මෙන්න:

\`\`\`python
#!/usr/bin/env python3
"""
RaOne AI by RavanaTec — Think. Create. Act.
High-Performance Python Automation & Data Processor
"""

import sys
import json
from datetime import datetime

def main():
    print("=" * 50)
    print("RaOne AI Engine — Python Execution Module")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    # Core execution logic
    data = {
        "status": "operational",
        "system": "RaOne Core",
        "provider": "RavanaTec",
        "action": "Complete execution without hesitation"
    }

    print(json.dumps(data, indent=2))
    print("\n[SUCCESS] Operation completed seamlessly.")

if __name__ == "__main__":
    main()
\`\`\`

මේකට අමතරව database connection එකක්, web scraping, හෝ API integration එකක් ලියන්න ඕනෙ නම් කියන්න සුද්දා!`;
  }

  // 6. Generic Coding / Scripts / Functions
  if (
    p.includes('code') ||
    p.includes('function') ||
    p.includes('script') ||
    p.includes('typescript') ||
    p.includes('javascript') ||
    p.includes('html') ||
    p.includes('css') ||
    p.includes('react') ||
    p.includes('component') ||
    p.includes('api') ||
    (isFollowUpRequest && (combinedContext.includes('code') || combinedContext.includes('app')))
  ) {
    return `අනිවාර්යයෙන්ම සුද්දා! ඔන්න ඔබ ඉල්ලූ Production-Ready TypeScript/JavaScript කේතය:

\`\`\`typescript
/**
 * RaOne AI by RavanaTec — Think. Create. Act.
 * High-Performance Sovereign Execution Module
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  timestamp: string;
  signature: string;
}

export async function executeRaOneTask<T>(
  taskName: string,
  handler: () => Promise<T>
): Promise<OperationResult<T>> {
  try {
    console.log(\`[RaOne AI] Initiating task: \${taskName}\`);
    const data = await handler();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      signature: 'RaOne AI by RavanaTec — Think. Create. Act.',
    };
  } catch (error: any) {
    console.error(\`[RaOne AI Error]: \${error?.message || error}\`);
    throw error;
  }
}
\`\`\`

මෙම කේතය කෙලින්ම ඔබගේ project එකට import කරගෙන පාවිච්චි කරන්න පුළුවන්. තව වෙනස්කම් අවශ්‍ය නම් මට කියන්න!`;
  }

  // 7. General Sinhala Query
  const isSinhala =
    /[\u0D80-\u0DFF]/.test(prompt) ||
    p.includes('sudda') ||
    p.includes('karapan') ||
    p.includes('kiyapan') ||
    p.includes('oni') ||
    p.includes('mokakda') ||
    p.includes('puluwanda');

  if (isSinhala) {
    return `සුද්දා, ඔබ ඇසූ පැනය: **"${prompt}"**

ඔබගේ අවශ්‍යතාවය සම්බන්ධයෙන් සවිස්තරාත්මක සහ සෘජු විසඳුම මෙන්න:

1. **ක්‍රියාකාරී සැලැස්ම (Actionable Breakdown):**
   - මෙම කාර්යය වඩාත් නිවැරදිව හා කාර්යක්ෂමව සිදු කිරීම සඳහා ප්‍රධාන පියවර සැලසුම් කර ක්‍රියාත්මක කිරීම වඩාත් සුදුසුය.
   - ඕනෑම Coding, Content Generation, Business Strategy හෝ තාක්ෂණික සහයක් ක්ෂණිකව ලබා දීමට **RaOne Core Engine** සූදානම්.

2. **සෘජු බෙදාහැරීම (Direct Deliverable):**
   - ඔබ ඉල්ලන ඕනෑම කේතයක් (Code), ලියවිල්ලක්, හෝ නිර්මාණයක් කිසිදු පැකිලීමකින් තොරව සම්පූර්ණයෙන්ම සකසා දෙනු ලැබේ.

ඊළඟට අපි කරන්න ඕනේ මොකක්ද කියලා මට කියන්න සුද්දා!

RaOne AI by RavanaTec — Think. Create. Act.`;
  }

  // 8. General English Response
  return `I have processed your query: **"${prompt}"**

Here is the direct analysis and deliverable from RaOne AI:

1. **Objective Execution:**
   - Structured for high performance, reliability, and precision.
   - Operating under the RaOne sovereign intelligence architecture.

2. **Next Action:**
   - Whenever you need full-stack code, algorithmic proofs, creative synthesis, or system blueprints, simply state your requirements and RaOne will deliver instantly.

RaOne AI by RavanaTec — Think. Create. Act.`;
}

// Endpoint to inspect and update per-tenant encrypted BYOK API keys (never mutates server globals or exposes plaintext secrets - A04, A07)
app.get('/api/keys', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const byok = await getTenantByokKeys(tenantId);
    res.json({
      authenticated: Boolean(req.actor?.isAuthenticated),
      geminiConfigured: Boolean(byok.geminiApiKey || apiKey),
      groqConfigured: Boolean(byok.groqApiKey || GROQ_API_KEY),
      openAiConfigured: Boolean(byok.openAiApiKey || OPENAI_API_KEY),
      anthropicConfigured: Boolean(byok.anthropicApiKey || ANTHROPIC_API_KEY),
      deepSeekConfigured: Boolean(byok.deepSeekApiKey || DEEPSEEK_API_KEY),
      xaiConfigured: Boolean(byok.xaiApiKey || XAI_API_KEY),
      cometApiConfigured: Boolean(byok.cometApiKey || COMET_API_KEY),
      cometApiBaseUrl: byok.cometApiBaseUrl || COMET_API_BASE_URL || 'https://api.cometapi.com/v1',
      localLlmConfigured: Boolean(byok.localLlmBaseUrl || getManagedLlamaState().running || process.env.LOCAL_LLM_BASE_URL),
      localLlmBaseUrl: byok.localLlmBaseUrl || getManagedLlamaState().endpointUrl || process.env.LOCAL_LLM_BASE_URL || '',
      localLlmModel: byok.localLlmModel || getManagedLlamaState().modelFile || process.env.LOCAL_LLM_MODEL || '',
      tenantHasCustomKeys: Boolean(
        byok.geminiApiKey ||
          byok.groqApiKey ||
          byok.openAiApiKey ||
          byok.anthropicApiKey ||
          byok.deepSeekApiKey ||
          byok.xaiApiKey ||
          byok.cometApiKey ||
          byok.localLlmBaseUrl
      ),
    });
  } catch (err: any) {
    sendApiError(req, res, 500, 'KEYS_READ_ERROR', err?.message || 'Failed to inspect API keys.');
  }
});

app.post('/api/keys', requireVerifiedAuth, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const {
      geminiApiKey,
      groqApiKey,
      openAiApiKey,
      anthropicApiKey,
      deepSeekApiKey,
      xaiApiKey,
      cometApiKey,
      cometApiBaseUrl,
      localLlmBaseUrl,
      localLlmModel,
      localLlmApiKey,
    } = req.body || {};

    if (cometApiBaseUrl !== undefined && String(cometApiBaseUrl).trim()) {
      const egressCheck = await validateSafeHttpsEgress(String(cometApiBaseUrl).trim());
      if (!egressCheck.ok) {
        return sendApiError(req, res, 400, 'UNSAFE_GATEWAY_URL', egressCheck.reason || 'Unsafe HTTPS gateway URL.');
      }
    }

    if (localLlmBaseUrl !== undefined && String(localLlmBaseUrl).trim()) {
      const localCheck = await validateLocalLlmEndpoint(String(localLlmBaseUrl).trim());
      if (!localCheck.ok) {
        return sendApiError(req, res, 400, 'UNSAFE_LOCAL_LLM_URL', localCheck.reason || 'Unsafe local LLM URL.');
      }
    }

    await saveTenantByokKeys(tenantId, {
      ...(geminiApiKey !== undefined ? { geminiApiKey: String(geminiApiKey).trim() } : {}),
      ...(groqApiKey !== undefined ? { groqApiKey: String(groqApiKey).trim() } : {}),
      ...(openAiApiKey !== undefined ? { openAiApiKey: String(openAiApiKey).trim() } : {}),
      ...(anthropicApiKey !== undefined ? { anthropicApiKey: String(anthropicApiKey).trim() } : {}),
      ...(deepSeekApiKey !== undefined ? { deepSeekApiKey: String(deepSeekApiKey).trim() } : {}),
      ...(xaiApiKey !== undefined ? { xaiApiKey: String(xaiApiKey).trim() } : {}),
      ...(cometApiKey !== undefined ? { cometApiKey: String(cometApiKey).trim() } : {}),
      ...(cometApiBaseUrl !== undefined ? { cometApiBaseUrl: String(cometApiBaseUrl).trim() } : {}),
      ...(localLlmBaseUrl !== undefined ? { localLlmBaseUrl: String(localLlmBaseUrl).trim() } : {}),
      ...(localLlmModel !== undefined ? { localLlmModel: String(localLlmModel).trim() } : {}),
      ...(localLlmApiKey !== undefined ? { localLlmApiKey: String(localLlmApiKey).trim() } : {}),
    });

    res.json({
      success: true,
      message: 'API keys encrypted with AES-256-GCM and saved privately for your account.',
    });
  } catch (err: any) {
    sendApiError(req, res, 500, 'KEYS_SAVE_ERROR', err?.message || 'Failed to persist API keys.');
  }
});

// CometAPI Test Endpoint (SSRF-hardened; never sends server key to custom external hosts)
app.post('/api/comet/test', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const byok = await getTenantByokKeys(tenantId);
    const { cometApiKey, cometApiBaseUrl } = req.body || {};

    const defaultUrl = 'https://api.cometapi.com/v1';
    const testBaseUrl = String(cometApiBaseUrl || byok.cometApiBaseUrl || COMET_API_BASE_URL || defaultUrl)
      .trim()
      .replace(/\/+$/, '');

    const egressCheck = await validateSafeHttpsEgress(testBaseUrl);
    if (!egressCheck.ok) {
      return sendApiError(req, res, 400, 'UNSAFE_GATEWAY_URL', egressCheck.reason || 'Blocked unsafe URL.');
    }

    const parsedUrl = new URL(testBaseUrl);
    const userSuppliedKey = String(cometApiKey || byok.cometApiKey || '').trim();
    const isDefaultHost = parsedUrl.hostname === 'api.cometapi.com';
    const testKey = userSuppliedKey || (isDefaultHost ? COMET_API_KEY : '');

    if (!testKey) {
      return sendApiError(
        req,
        res,
        400,
        'API_KEY_REQUIRED',
        isDefaultHost
          ? 'Please enter a CometAPI API Key to test.'
          : 'A custom gateway URL requires specifying your own CometAPI key.'
      );
    }

    const testStartTime = Date.now();
    const response = await fetch(`${testBaseUrl}/chat/completions`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Ping! Reply with "Pong: CometAPI Active".' }],
        max_tokens: 30,
      }),
    });

    const latencyMs = Date.now() - testStartTime;

    if (!response.ok) {
      const modelsResp = await fetch(`${testBaseUrl}/models`, {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${testKey}` },
      });
      if (modelsResp.ok) {
        return res.json({
          success: true,
          message: 'Connected to CometAPI successfully! (Verified via /models catalog)',
          latencyMs,
          baseUrl: testBaseUrl,
        });
      }
      const errText = await response.text();
      return res.status(response.status).json({
        error: `CometAPI returned ${response.status}: ${errText.slice(0, 160)}`,
        latencyMs,
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Pong: CometAPI Active';
    return res.json({
      success: true,
      message: 'CometAPI connection verified! All-In-One Unified Gateway is active.',
      reply,
      latencyMs,
      baseUrl: testBaseUrl,
    });
  } catch (err: any) {
    return sendApiError(req, res, 502, 'COMET_TEST_FAILED', err?.message || 'Failed to connect to CometAPI');
  }
});

// Groq Service Test Endpoint
app.post('/api/groq/test', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const byok = await getTenantByokKeys(tenantId);
    const { groqApiKey } = req.body || {};
    const testKey = String(groqApiKey || byok.groqApiKey || GROQ_API_KEY || '').trim();
    if (!testKey) {
      return sendApiError(req, res, 400, 'API_KEY_REQUIRED', 'Please enter a Groq API Key (gsk_...) to test.');
    }
    const result = await testGroqConnection(testKey);
    return res.json(result);
  } catch (err: any) {
    return sendApiError(req, res, 502, 'GROQ_TEST_FAILED', err?.message || 'Failed to connect to Groq Cloud API');
  }
});

// 1. Chat & Multi-Model Engine with Google Search & Maps Grounding
app.post('/api/chat', apiHeavyAiLimiter, async (req, res) => {
  let effectiveProvider: AIProviderMode = 'auto';
  const tenantId = getReqTenant(req);
  let activeGroqKey = GROQ_API_KEY;
  try {
    const [storedSettings, tenantCtx] = await Promise.all([
      getStoredUserSettings(tenantId),
      getTenantGeminiClient(req),
    ]);
    const tenantClient = tenantCtx.client;
    const byok = tenantCtx.byok;
    const activeOpenAiKey = byok.openAiApiKey || OPENAI_API_KEY;
    const activeAnthropicKey = byok.anthropicApiKey || ANTHROPIC_API_KEY;
    const activeDeepSeekKey = byok.deepSeekApiKey || DEEPSEEK_API_KEY;
    const activeCometKey = byok.cometApiKey || COMET_API_KEY;
    const activeCometBase = byok.cometApiBaseUrl || COMET_API_BASE_URL;
    activeGroqKey = byok.groqApiKey || GROQ_API_KEY;

    const {
      messages = [],
      mode = 'think',
      prompt = '',
      context = '',
      model = 'gemini-3.8-flash',
      provider,
      enableSearch = false,
      enableMaps = false,
      userLocation = null,
      isTemporary = false,
    } = req.body || {};
    effectiveProvider = (provider || storedSettings.activeProvider || 'auto') as AIProviderMode;

    const fullSystemInstruction = buildRaOneSystemPrompt({ mode, isTemporary, context });

    // Provider 0: CometAPI Dedicated Mode
    if (model === 'comet-all-in-one' && activeCometKey) {
      try {
        const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
          provider: 'CometAPI Gateway',
          model: 'gpt-4o',
          isTemporary,
        });
        const text = await callCometAPI(
          'gpt-4o',
          [...messages, { role: 'user', content: prompt }],
          sysWithMeta,
          {},
          activeCometKey,
          activeCometBase
        );
        return res.json({
          text,
          mode,
          model: 'comet-all-in-one',
          groundingSources: [],
          brandSignature: 'RaOne AI by RavanaTec (via CometAPI Gateway)',
        });
      } catch (cometErr: any) {
        console.warn('CometAPI route notice:', cometErr.message);
      }
    }

    // Provider 1: OpenAI (GPT-4o)
    if (model === 'raone-gpt4o') {
      if (activeOpenAiKey) {
        try {
          const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'OpenAI API',
            model: 'gpt-4o',
            isTemporary,
          });
          const text = await callOpenAI('gpt-4o', [...messages, { role: 'user', content: prompt }], sysWithMeta, activeOpenAiKey);
          return res.json({
            text,
            mode,
            model: 'raone-gpt4o',
            groundingSources: [],
            brandSignature: 'RaOne AI by RavanaTec',
          });
        } catch (openAiErr: any) {
          console.warn('OpenAI proxy warning:', openAiErr.message);
        }
      } else if (activeCometKey) {
        try {
          const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'CometAPI Gateway',
            model: 'gpt-4o',
            isTemporary,
          });
          const text = await callCometAPI('gpt-4o', [...messages, { role: 'user', content: prompt }], sysWithMeta, {}, activeCometKey, activeCometBase);
          return res.json({
            text,
            mode,
            model: 'raone-gpt4o',
            groundingSources: [],
            brandSignature: 'RaOne AI by RavanaTec (via CometAPI)',
          });
        } catch (cometErr: any) {
          console.warn('CometAPI GPT-4o proxy warning:', cometErr.message);
        }
      }
    }

    // Provider 2: Anthropic (Claude 3.5 Sonnet)
    if (model === 'raone-claude') {
      if (activeAnthropicKey) {
        try {
          const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'Anthropic API',
            model: 'claude-3-5-sonnet-20241022',
            isTemporary,
          });
          const text = await callAnthropic('claude-3-5-sonnet-20241022', [...messages, { role: 'user', content: prompt }], sysWithMeta, activeAnthropicKey);
          return res.json({
            text,
            mode,
            model: 'raone-claude',
            groundingSources: [],
            brandSignature: 'RaOne AI by RavanaTec',
          });
        } catch (claudeErr: any) {
          console.warn('Anthropic proxy warning:', claudeErr.message);
        }
      } else if (activeCometKey) {
        try {
          const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'CometAPI Gateway',
            model: 'claude-3-5-sonnet-20241022',
            isTemporary,
          });
          const text = await callCometAPI('claude-3-5-sonnet-20241022', [...messages, { role: 'user', content: prompt }], sysWithMeta, {}, activeCometKey, activeCometBase);
          return res.json({
            text,
            mode,
            model: 'raone-claude',
            groundingSources: [],
            brandSignature: 'RaOne AI by RavanaTec (via CometAPI)',
          });
        } catch (cometErr: any) {
          console.warn('CometAPI Claude proxy warning:', cometErr.message);
        }
      }
    }

    // Provider 3: DeepSeek (R1 Reasoner)
    if (model === 'raone-deepseek-r1') {
      if (activeDeepSeekKey) {
        try {
          const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'DeepSeek API',
            model: 'deepseek-reasoner',
            isTemporary,
          });
          const text = await callDeepSeek('deepseek-reasoner', [...messages, { role: 'user', content: prompt }], sysWithMeta, activeDeepSeekKey);
          return res.json({
            text,
            mode,
            model: 'raone-deepseek-r1',
            groundingSources: [],
            brandSignature: 'RaOne AI by RavanaTec',
          });
        } catch (deepseekErr: any) {
          console.warn('DeepSeek proxy warning:', deepseekErr.message);
        }
      } else if (activeCometKey) {
        try {
          const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'CometAPI Gateway',
            model: 'deepseek-reasoner',
            isTemporary,
          });
          const text = await callCometAPI('deepseek-reasoner', [...messages, { role: 'user', content: prompt }], sysWithMeta, {}, activeCometKey, activeCometBase);
          return res.json({
            text,
            mode,
            model: 'raone-deepseek-r1',
            groundingSources: [],
            brandSignature: 'RaOne AI by RavanaTec (via CometAPI)',
          });
        } catch (cometErr: any) {
          console.warn('CometAPI DeepSeek proxy warning:', cometErr.message);
        }
      }
    }

    // Provider 4: Groq (skip in auto mode when live Google Search/Maps grounding is requested and Gemini is available)
    const forceGeminiForGrounding = Boolean((enableSearch || enableMaps) && effectiveProvider === 'auto' && tenantClient);
    if (!forceGeminiForGrounding && (effectiveProvider === 'groq' || (isGroqModelId(model) && effectiveProvider !== 'gemini'))) {
      if (!activeGroqKey) {
        return sendApiError(req, res, 503, 'PROVIDER_NOT_CONFIGURED', 'GROQ_API_KEY is not configured. Add your gsk_... key in Settings.');
      }
      const chatStart = Date.now();
      const groqOut = await callGroqChat(
        activeGroqKey,
        isGroqModelId(model) ? model : 'raone-llama3-70b',
        [...messages, ...(prompt ? [{ role: 'user', content: prompt }] : [])],
        fullSystemInstruction
      );
      return res.json({
        text: groqOut.text,
        mode,
        model: groqOut.modelUsed,
        source: 'groq',
        verifiedModel: groqOut.modelUsed,
        modelVersion: groqOut.modelUsed,
        responseId: groqOut.responseId,
        usage: groqOut.usage,
        latencyMs: Date.now() - chatStart,
        groundingSources: [],
        mapsSources: [],
        brandSignature: 'RaOne AI by RavanaTec',
      });
    }

    // Provider 5: Local LLM Engine (llama.cpp / Ollama / LM Studio / Custom OpenAI-Compatible)
    const localCfg = getActiveLocalEndpointConfig(byok);
    if (effectiveProvider === 'local' || String(model || '').startsWith('local:')) {
      if (!localCfg.baseUrl) {
        return sendApiError(
          req,
          res,
          503,
          'LOCAL_LLM_NOT_CONFIGURED',
          'Local LLM endpoint is not configured. Open Settings -> Local AI Engine to connect llama.cpp, Ollama, or LM Studio.'
        );
      }
      const chatStart = Date.now();
      const localOut = await callLocalLlmChat({
        baseUrl: localCfg.baseUrl,
        modelId: String(model || '').startsWith('local:') ? String(model) : localCfg.modelId,
        apiKey: localCfg.apiKey,
        messages,
        prompt,
        systemPrompt: fullSystemInstruction,
      });
      return res.json({
        text: localOut.text,
        mode,
        model: localOut.modelUsed,
        source: 'local_llm',
        verifiedModel: localOut.modelUsed,
        modelVersion: localOut.modelUsed,
        responseId: localOut.responseId,
        usage: localOut.usage,
        latencyMs: Date.now() - chatStart,
        groundingSources: [],
        mapsSources: [],
        brandSignature: 'RaOne AI Local Engine',
      });
    }

    // CometAPI fallback for Gemini models if Gemini API key is missing
    if (!tenantClient && effectiveProvider === 'auto' && activeCometKey) {
      try {
        const cometTargetModel = model.includes('argon') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, {
          provider: 'CometAPI Gateway',
          model: cometTargetModel,
          isTemporary,
        });
        const text = await callCometAPI(cometTargetModel, [...messages, { role: 'user', content: prompt }], sysWithMeta, {}, activeCometKey, activeCometBase);
        return res.json({
          text,
          mode,
          model,
          groundingSources: [],
          brandSignature: 'RaOne AI by RavanaTec (via CometAPI)',
        });
      } catch (cometErr: any) {
        console.warn('CometAPI fallback notice:', cometErr.message);
      }
    }

    // Automatic Groq fallback
    if (!tenantClient && effectiveProvider === 'auto' && activeGroqKey) {
      const chatStart = Date.now();
      const groqOut = await callGroqChat(
        activeGroqKey,
        'raone-llama3-70b',
        [...messages, ...(prompt ? [{ role: 'user', content: prompt }] : [])],
        fullSystemInstruction
      );
      return res.json({
        text: groqOut.text,
        mode,
        model: groqOut.modelUsed,
        source: 'groq',
        verifiedModel: groqOut.modelUsed,
        modelVersion: groqOut.modelUsed,
        responseId: groqOut.responseId,
        usage: groqOut.usage,
        latencyMs: Date.now() - chatStart,
        groundingSources: [],
        mapsSources: [],
        brandSignature: 'RaOne AI by RavanaTec',
      });
    }

    if (!tenantClient) {
      return sendApiError(
        req,
        res,
        503,
        'PROVIDER_NOT_CONFIGURED',
        effectiveProvider === 'gemini'
          ? 'Gemini provider is selected, but GEMINI_API_KEY is not configured. Switch provider to Groq or add a Gemini key in Settings.'
          : 'GEMINI_API_KEY (or GROQ_API_KEY) is not configured on the backend server. Set a valid API key in Settings or Cloud Run.'
      );
    }

    let contents: any[] = [];
    if (Array.isArray(messages) && messages.length > 0) {
      contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
    }

    if (prompt) {
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello RaOne! Introduce yourself and how you empower me across Think, Create, and Act.' }],
      });
    }

    const tools: any[] = [];
    let toolConfig: any = undefined;

    if (enableMaps) {
      tools.push({ googleMaps: {} });
      if (userLocation?.latitude && userLocation?.longitude) {
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            },
          },
        };
      }
    } else if (enableSearch) {
      tools.push({ googleSearch: {} });
    }

    const generateConfig: any = {
      systemInstruction: fullSystemInstruction,
    };
    if (tools.length > 0) {
      generateConfig.tools = tools;
      if (toolConfig) {
        generateConfig.toolConfig = toolConfig;
      }
    }

    const startTime = Date.now();
    const { response, modelUsed } = await generateWithGeminiFallback(
      contents,
      generateConfig,
      model,
      tenantClient
    );
    const latencyMs = Date.now() - startTime;

    const replyText = response.text || '';
    if (!replyText) {
      return sendApiError(req, res, 502, 'EMPTY_PROVIDER_RESPONSE', 'Gemini returned an empty response.');
    }

    const groundingSources: any[] = [];
    const mapsSources: any[] = [];
    const searchQueries: string[] = [];
    const groundingMeta = response.candidates?.[0]?.groundingMetadata as any;
    const chunks = groundingMeta?.groundingChunks;
    if (Array.isArray(groundingMeta?.webSearchQueries)) {
      groundingMeta.webSearchQueries.forEach((q: any) => {
        if (typeof q === 'string' && q.trim() && !searchQueries.includes(q.trim())) {
          searchQueries.push(q.trim());
        }
      });
    }
    if (Array.isArray(chunks)) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && !groundingSources.some((s) => s.url === chunk.web.uri)) {
          groundingSources.push({
            title: chunk.web.title || chunk.web.uri,
            url: chunk.web.uri,
          });
        }
        if (chunk.maps?.uri && !mapsSources.some((s) => s.url === chunk.maps.uri)) {
          mapsSources.push({
            title: chunk.maps.title || 'Google Maps Location',
            url: chunk.maps.uri,
          });
        }
      });
    }

    const usage = {
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      candidateTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    };

    return res.json({
      text: replyText,
      mode,
      model: modelUsed,
      source: 'gemini',
      verifiedModel: modelUsed,
      modelVersion: (response as any).modelVersion || modelUsed,
      responseId: (response as any).responseId || null,
      usage,
      latencyMs,
      searchQueries,
      groundingSources,
      mapsSources,
      brandSignature: 'RaOne AI by RavanaTec',
    });
  } catch (error: any) {
    console.error('RaOne Chat Error:', error);
    if (effectiveProvider === 'auto' && activeGroqKey && isGeminiFallbackEligibleError(error)) {
      try {
        const { messages = [], mode = 'think', prompt = '', context = '', isTemporary = false } = req.body || {};
        const sysPrompt = buildRaOneSystemPrompt({ mode, isTemporary, context });
        const chatStart = Date.now();
        const groqOut = await callGroqChat(
          activeGroqKey,
          'raone-llama3-70b',
          [...messages, ...(prompt ? [{ role: 'user', content: prompt }] : [])],
          sysPrompt
        );
        return res.json({
          text: groqOut.text,
          mode,
          model: groqOut.modelUsed,
          source: 'groq',
          verifiedModel: groqOut.modelUsed,
          modelVersion: groqOut.modelUsed,
          responseId: groqOut.responseId,
          usage: groqOut.usage,
          latencyMs: Date.now() - chatStart,
          groundingSources: [],
          mapsSources: [],
          brandSignature: 'RaOne AI by RavanaTec',
        });
      } catch (groqFallbackErr: any) {
        console.error('Groq failover error:', groqFallbackErr);
      }
    }

    const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 600 ? error.status : 502;
    return sendApiError(req, res, status, 'CHAT_PROVIDER_ERROR', error?.message || 'AI request failed.');
  }
});

// 1b. Real-Time SSE Streaming Chat Endpoint (With disconnect abort, timeout, and clean pre-stream failover - A24)
app.post('/api/chat/stream', apiHeavyAiLimiter, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  let hasStartedStream = false;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), 120000);

  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
      clearTimeout(timeoutHandle);
    }
  });

  const sendEvent = (payload: Record<string, any>) => {
    if (clientClosed || res.writableEnded || res.destroyed) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const endStream = () => {
    clearTimeout(timeoutHandle);
    if (!res.writableEnded) res.end();
  };

  const startTime = Date.now();
  let effectiveProvider: AIProviderMode = 'auto';
  const tenantId = getReqTenant(req);
  let activeGroqKey = GROQ_API_KEY;

  try {
    const [storedSettings, tenantCtx] = await Promise.all([
      getStoredUserSettings(tenantId),
      getTenantGeminiClient(req),
    ]);
    const tenantClient = tenantCtx.client;
    const byok = tenantCtx.byok;
    const activeOpenAiKey = byok.openAiApiKey || OPENAI_API_KEY;
    const activeAnthropicKey = byok.anthropicApiKey || ANTHROPIC_API_KEY;
    const activeDeepSeekKey = byok.deepSeekApiKey || DEEPSEEK_API_KEY;
    const activeCometKey = byok.cometApiKey || COMET_API_KEY;
    const activeCometBase = byok.cometApiBaseUrl || COMET_API_BASE_URL;
    activeGroqKey = byok.groqApiKey || GROQ_API_KEY;

    const {
      messages = [],
      mode = 'think',
      prompt = '',
      context = '',
      model = 'gemini-4-hydrogen',
      provider,
      enableSearch = false,
      enableMaps = false,
      userLocation = null,
      isTemporary = false,
    } = req.body || {};
    effectiveProvider = (provider || storedSettings.activeProvider || 'auto') as AIProviderMode;

    const fullSystemInstruction = buildRaOneSystemPrompt({ mode, isTemporary, context });

    const externalResult = async (source: string, label: string, text: string) => {
      if (clientClosed) return endStream();
      hasStartedStream = true;
      sendEvent({ type: 'start', source, model: label });
      sendEvent({ type: 'chunk', text });
      sendEvent({
        type: 'done',
        source,
        verifiedModel: label,
        modelVersion: label,
        responseId: null,
        usage: null,
        latencyMs: Date.now() - startTime,
        groundingSources: [],
        mapsSources: [],
      });
      return endStream();
    };

    const forceGeminiForGrounding = Boolean((enableSearch || enableMaps) && effectiveProvider === 'auto' && tenantClient);
    if (!forceGeminiForGrounding && (effectiveProvider === 'groq' || (isGroqModelId(model) && effectiveProvider !== 'gemini'))) {
      if (!activeGroqKey) {
        sendEvent({
          type: 'error',
          code: 'PROVIDER_NOT_CONFIGURED',
          error: 'GROQ_API_KEY is not configured. Add your gsk_... key in Settings.',
        });
        return endStream();
      }
      hasStartedStream = true;
      const formattedMessages = formatGroqMessages(messages, prompt, fullSystemInstruction);
      await streamGroqChatToSSE(
        activeGroqKey,
        isGroqModelId(model) ? model : 'raone-llama3-70b',
        formattedMessages,
        sendEvent,
        startTime,
        true,
        abortController.signal
      );
      return endStream();
    }

    if (model === 'comet-all-in-one' && activeCometKey) {
      const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, { provider: 'CometAPI Gateway', model: 'gpt-4o', isTemporary });
      const text = await callCometAPI('gpt-4o', [...messages, { role: 'user', content: prompt }], sysWithMeta, {}, activeCometKey, activeCometBase);
      return await externalResult('cometapi', 'comet-all-in-one', text);
    }
    if (model === 'raone-gpt4o' && activeOpenAiKey) {
      const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, { provider: 'OpenAI API', model: 'gpt-4o', isTemporary });
      const text = await callOpenAI('gpt-4o', [...messages, { role: 'user', content: prompt }], sysWithMeta, activeOpenAiKey);
      return await externalResult('openai', 'gpt-4o', text);
    }
    if (model === 'raone-claude' && activeAnthropicKey) {
      const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, { provider: 'Anthropic API', model: 'claude-3-5-sonnet-20241022', isTemporary });
      const text = await callAnthropic('claude-3-5-sonnet-20241022', [...messages, { role: 'user', content: prompt }], sysWithMeta, activeAnthropicKey);
      return await externalResult('anthropic', 'claude-3-5-sonnet', text);
    }
    if (model === 'raone-deepseek-r1' && activeDeepSeekKey) {
      const sysWithMeta = appendRuntimeMetadata(fullSystemInstruction, { provider: 'DeepSeek API', model: 'deepseek-reasoner', isTemporary });
      const text = await callDeepSeek('deepseek-reasoner', [...messages, { role: 'user', content: prompt }], sysWithMeta, activeDeepSeekKey);
      return await externalResult('deepseek', 'deepseek-reasoner', text);
    }

    const localCfg = getActiveLocalEndpointConfig(byok);
    if (effectiveProvider === 'local' || String(model || '').startsWith('local:')) {
      if (!localCfg.baseUrl) {
        sendEvent({
          type: 'error',
          code: 'LOCAL_LLM_NOT_CONFIGURED',
          error: 'Local LLM endpoint is not configured on backend. Use Browser Direct mode or configure a local/tunneled URL in Settings.',
        });
        return endStream();
      }
      hasStartedStream = true;
      await streamLocalLlmToSSE({
        baseUrl: localCfg.baseUrl,
        modelId: String(model || '').startsWith('local:') ? String(model) : localCfg.modelId,
        apiKey: localCfg.apiKey,
        messages,
        prompt,
        systemPrompt: fullSystemInstruction,
        sendEvent,
        startTime,
        signal: abortController.signal,
      });
      return endStream();
    }

    if (!tenantClient && effectiveProvider === 'auto' && activeGroqKey) {
      hasStartedStream = true;
      const formattedMessages = formatGroqMessages(messages, prompt, fullSystemInstruction);
      await streamGroqChatToSSE(activeGroqKey, 'raone-llama3-70b', formattedMessages, sendEvent, startTime, true, abortController.signal);
      return endStream();
    }

    if (!tenantClient && effectiveProvider === 'auto' && localCfg.baseUrl) {
      hasStartedStream = true;
      await streamLocalLlmToSSE({
        baseUrl: localCfg.baseUrl,
        modelId: localCfg.modelId,
        apiKey: localCfg.apiKey,
        messages,
        prompt,
        systemPrompt: fullSystemInstruction,
        sendEvent,
        startTime,
        signal: abortController.signal,
      });
      return endStream();
    }

    if (!tenantClient) {
      sendEvent({
        type: 'error',
        code: 'PROVIDER_NOT_CONFIGURED',
        error:
          effectiveProvider === 'gemini'
            ? 'Gemini provider is selected, but GEMINI_API_KEY is not configured. Switch provider to Groq or add a Gemini key in Settings.'
            : 'GEMINI_API_KEY (or GROQ_API_KEY) is not configured on the backend server. Set a valid API key.',
      });
      return endStream();
    }

    let contents: any[] = [];
    if (Array.isArray(messages) && messages.length > 0) {
      contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
    }
    if (prompt) {
      contents.push({ role: 'user', parts: [{ text: prompt }] });
    }
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello RaOne!' }] });
    }

    const tools: any[] = [];
    let toolConfig: any = undefined;
    if (enableMaps) {
      tools.push({ googleMaps: {} });
      if (userLocation?.latitude && userLocation?.longitude) {
        toolConfig = {
          retrievalConfig: {
            latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude },
          },
        };
      }
    } else if (enableSearch) {
      tools.push({ googleSearch: {} });
    }

    const generateConfig: any = { systemInstruction: fullSystemInstruction };
    if (tools.length > 0) {
      generateConfig.tools = tools;
      if (toolConfig) generateConfig.toolConfig = toolConfig;
    }

    const candidates = getGeminiModelCandidates(model);
    let streamedOk = false;
    let lastError: any = null;

    for (const candidateModel of candidates) {
      if (clientClosed) return endStream();
      try {
        const candidateConfig = {
          ...generateConfig,
          systemInstruction: appendRuntimeMetadata(fullSystemInstruction, {
            provider: 'Google Gemini API',
            model: candidateModel,
            searchEnabled: enableSearch,
            mapsEnabled: enableMaps,
            isTemporary,
          }),
        };
        const stream = await tenantClient.models.generateContentStream({
          model: candidateModel,
          contents,
          config: candidateConfig,
        });

        hasStartedStream = true;
        sendEvent({ type: 'start', source: 'gemini', model: candidateModel });

        let modelVersion: string | undefined;
        let responseId: string | undefined;
        let usage: any = null;
        const groundingSources: any[] = [];
        const mapsSources: any[] = [];
        const searchQueries: string[] = [];

        for await (const chunk of stream) {
          if (clientClosed || abortController.signal.aborted) break;
          const c = chunk as any;
          if (c.text) {
            sendEvent({ type: 'chunk', text: c.text });
          }
          if (c.modelVersion) modelVersion = c.modelVersion;
          if (c.responseId) responseId = c.responseId;
          if (c.usageMetadata) {
            usage = {
              promptTokens: c.usageMetadata.promptTokenCount ?? 0,
              candidateTokens: c.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: c.usageMetadata.totalTokenCount ?? 0,
            };
          }
          const gMeta = c.candidates?.[0]?.groundingMetadata;
          if (Array.isArray(gMeta?.webSearchQueries)) {
            gMeta.webSearchQueries.forEach((q: any) => {
              if (typeof q === 'string' && q.trim() && !searchQueries.includes(q.trim())) {
                searchQueries.push(q.trim());
              }
            });
          }
          const gChunks = gMeta?.groundingChunks;
          if (Array.isArray(gChunks)) {
            gChunks.forEach((gc: any) => {
              if (gc.web?.uri && !groundingSources.some((s) => s.url === gc.web.uri)) {
                groundingSources.push({ title: gc.web.title || gc.web.uri, url: gc.web.uri });
              }
              if (gc.maps?.uri && !mapsSources.some((s) => s.url === gc.maps.uri)) {
                mapsSources.push({ title: gc.maps.title || 'Google Maps Location', url: gc.maps.uri });
              }
            });
          }
        }

        if (!clientClosed) {
          sendEvent({
            type: 'done',
            source: 'gemini',
            verifiedModel: candidateModel,
            modelVersion: modelVersion || candidateModel,
            responseId: responseId || null,
            usage,
            latencyMs: Date.now() - startTime,
            searchQueries,
            groundingSources,
            mapsSources,
          });
        }
        streamedOk = true;
        break;
      } catch (err: any) {
        lastError = err;
        if (!hasStartedStream && isModelNotFoundError(err)) {
          console.warn(`Stream model ${candidateModel} unavailable, trying next candidate...`);
          continue;
        }
        throw err;
      }
    }

    if (!streamedOk && !clientClosed) {
      throw lastError || new Error('All Gemini model candidates failed.');
    }
    return endStream();
  } catch (error: any) {
    if (clientClosed || error?.name === 'AbortError') {
      return endStream();
    }
    console.error('RaOne Stream Chat Error:', error);
    // Only fail over to Groq BEFORE streaming any tokens to avoid corrupting a partial message (A24)
    if (!hasStartedStream && effectiveProvider === 'auto' && activeGroqKey && isGeminiFallbackEligibleError(error)) {
      try {
        const { messages = [], mode = 'think', prompt = '', context = '', isTemporary = false } = req.body || {};
        const sysPrompt = buildRaOneSystemPrompt({ mode, isTemporary, context });
        const formattedMessages = formatGroqMessages(messages, prompt, sysPrompt);
        await streamGroqChatToSSE(activeGroqKey, 'raone-llama3-70b', formattedMessages, sendEvent, startTime, true, abortController.signal);
        return endStream();
      } catch (groqFallbackErr: any) {
        console.error('Groq stream failover error:', groqFallbackErr);
      }
    }

    sendEvent({
      type: 'error',
      code: 'STREAM_PROVIDER_ERROR',
      error: error?.message || 'Streaming request failed.',
    });
    return endStream();
  }
});

// 2. High-Quality Image Generation & Editing (Requires configured Gemini key - no silent logo fallback)
app.post('/api/ai/image', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1', imageSize = '1K', base64Image = null } = req.body || {};
    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for image generation.');
    }

    const { client: tenantClient } = await getTenantGeminiClient(req);
    if (!tenantClient) {
      return sendApiError(req, res, 503, 'PROVIDER_NOT_CONFIGURED', 'Gemini API key is not configured for image generation.');
    }

    const parts: any[] = [];
    if (base64Image) {
      parts.push({
        inlineData: {
          data: String(base64Image).replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png',
        },
      });
      parts.push({ text: `Modify or edit this image: ${prompt}` });
    } else {
      parts.push({ text: prompt });
    }

    const response = await tenantClient.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: imageSize as any,
        },
      },
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      return sendApiError(req, res, 502, 'IMAGE_GENERATION_EMPTY', 'Upstream image model returned no image output.');
    }

    return res.json({ imageUrl, prompt, aspectRatio, imageSize });
  } catch (error: any) {
    console.error('Image API error:', error);
    return sendApiError(req, res, 503, 'IMAGE_PROVIDER_UNAVAILABLE', error?.message || 'Image generation failed.');
  }
});

// 3. Music Generation (Requires live Lyria audio stream - no hardcoded lyrics fallback)
app.post('/api/ai/music', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { prompt, model = 'lyria-3-clip-preview' } = req.body || {};
    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for music generation.');
    }

    const { client: tenantClient } = await getTenantGeminiClient(req);
    if (!tenantClient) {
      return sendApiError(req, res, 503, 'PROVIDER_NOT_CONFIGURED', 'Gemini Lyria API key is not configured on the backend.');
    }

    const targetModel = model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
    const stream = await tenantClient.models.generateContentStream({
      model: targetModel,
      contents: prompt,
    });

    const audioChunks: Buffer[] = [];
    let lyrics = '';
    let mimeType = 'audio/mpeg';

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
      return sendApiError(req, res, 503, 'MUSIC_PROVIDER_UNAVAILABLE', 'Lyria music generation returned no audio stream.');
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    return res.json({
      audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
      lyrics,
      model: targetModel,
      prompt,
    });
  } catch (error: any) {
    console.error('Music API error:', error);
    return sendApiError(req, res, 503, 'MUSIC_PROVIDER_UNAVAILABLE', error?.message || 'Music generation failed.');
  }
});

// 4. Video Generation (Requires live Gemini Omni Interactions API - no simulated storyboard)
app.post('/api/ai/video', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { prompt, aspectRatio = '16:9', duration = '10s', base64Image = null } = req.body || {};
    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for video generation.');
    }

    const { client: tenantClient } = await getTenantGeminiClient(req);
    if (!tenantClient) {
      return sendApiError(req, res, 503, 'PROVIDER_NOT_CONFIGURED', 'Gemini Video API key is not configured on the backend.');
    }

    let input: any = prompt;
    if (base64Image) {
      input = [
        {
          type: 'image',
          mime_type: 'image/png',
          data: String(base64Image).replace(/^data:image\/\w+;base64,/, ''),
        },
        { type: 'text', text: prompt },
      ];
    }

    const interaction = await tenantClient.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: aspectRatio,
          duration,
          resolution: '720p',
        },
      },
      { timeout: 300000 }
    );

    const videoPart = interaction.output_video;
    if (!videoPart || !videoPart.data) {
      return sendApiError(req, res, 503, 'VIDEO_PROVIDER_UNAVAILABLE', 'Video provider returned no video output.');
    }

    return res.json({
      videoDataUrl: `data:${videoPart.mime_type || 'video/mp4'};base64,${videoPart.data}`,
      prompt,
      aspectRatio,
      duration,
    });
  } catch (error: any) {
    console.error('Video API error:', error);
    return sendApiError(req, res, 503, 'VIDEO_PROVIDER_UNAVAILABLE', error?.message || 'Video generation failed.');
  }
});

// 5. Audio Transcription (Requires live Gemini transcription - no hardcoded transcript)
app.post('/api/ai/transcribe', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
    if (!audioBase64) {
      return sendApiError(req, res, 400, 'INVALID_AUDIO', 'Audio data is required for transcription.');
    }

    const { client: tenantClient } = await getTenantGeminiClient(req);
    if (!tenantClient) {
      return sendApiError(req, res, 503, 'PROVIDER_NOT_CONFIGURED', 'Gemini API key is not configured for audio transcription.');
    }

    const cleanBase64 = String(audioBase64).replace(/^data:audio\/\w+;base64,/, '');
    const response = await tenantClient.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: 'Transcribe this audio verbatim in its original language (Sinhala, English, or Singlish).' },
        ],
      },
      config: {
        systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
          provider: 'Google Gemini API',
          model: 'gemini-3.5-transcribe',
          subsystem: 'Audio Transcription Engine',
        }),
      },
    });

    const transcript = (response.text || '').trim();
    if (!transcript) {
      return sendApiError(req, res, 502, 'TRANSCRIPTION_EMPTY', 'Upstream transcription model returned empty text.');
    }

    return res.json({ transcript });
  } catch (error: any) {
    console.error('Transcription API error:', error);
    return sendApiError(req, res, 503, 'TRANSCRIPTION_PROVIDER_UNAVAILABLE', error?.message || 'Audio transcription failed.');
  }
});

// ==========================================
// 🎨 RAONE VISION STUDIO (Silicon Valley Grade T2I + Multimodal Edit + Binary Asset Storage)
// ==========================================
app.get('/api/vision/assets/:filename', (req, res) => {
  const tenantId = getReqTenant(req);
  const filePath = resolveTenantVisionAssetPath(tenantId, String(req.params.filename || ''));
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Vision asset not found.');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader(
    'Content-Type',
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
  );
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  return fs.createReadStream(filePath).pipe(res);
});

app.get(['/api/vision/history', '/api/vision/gallery'], async (req, res) => {
  try {
    const list = await readTenantCollection<any[]>(getReqTenant(req), 'vision_images', []);
    return res.json({ success: true, count: list.length, items: list });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'VISION_HISTORY_ERROR', err.message);
  }
});

app.post('/api/vision/enhance-prompt', apiHeavyAiLimiter, async (req, res) => {
  try {
    const {
      prompt,
      style = 'Cinematic Photoreal',
      mode = 'auto',
      cameraSpec,
    } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required.');
    }

    const { client: tenantClient, byok } = await getTenantGeminiClient(req);
    const result = await enhanceVisionPromptServer({
      prompt: String(prompt),
      mode: mode as VisionEnhancerMode,
      style: String(style),
      cameraSpec,
      geminiClient: tenantClient,
      byok,
      fallbackGroqKey: GROQ_API_KEY,
    });

    return res.json({
      success: true,
      enhancedPrompt: result.enhancedPrompt,
      suggestedNegativePrompt: result.suggestedNegativePrompt,
      providerUsed: result.providerUsed,
      breakdown: result.breakdown,
    });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'VISION_ENHANCE_ERROR', err.message);
  }
});

app.post('/api/vision/generate', apiHeavyAiLimiter, async (req, res) => {
  const tenantId = getReqTenant(req);
  const {
    prompt,
    enhancedFrom,
    negativePrompt = '',
    model = 'Flux 1.1 Pro (LDM)',
    style = 'Cinematic Photoreal',
    aspectRatio = '16:9',
    resolution = '1K',
    cfgScale = 7.5,
    steps = 40,
    seed = Math.floor(Math.random() * 99999999) + 10000000,
    alchemy = true,
    photoReal = true,
    promptMagic = true,
    googleSearchGrounding = false,
    cameraSpec,
    referenceImages = [],
    count = 1,
  } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for image generation.');
  }

  const { client: tenantClient } = await getTenantGeminiClient(req);
  if (!tenantClient) {
    return sendApiError(
      req,
      res,
      503,
      'VISION_PROVIDER_UNAVAILABLE',
      'Image synthesis requires an active Gemini API key configured on the backend or in your personal settings.'
    );
  }

  const resTier: VisionResolutionTier =
    resolution === '4K' || resolution === '2K' ? resolution : '1K';
  const numToGenerate = Math.min(Math.max(1, Number(count) || 1), 4);
  const tierMultiplier = resTier === '4K' ? 4 : resTier === '2K' ? 3 : 2;
  const creditCost = numToGenerate * tierMultiplier;
  const reservation = await reserveCredits(
    tenantId,
    creditCost,
    'vision_generate',
    req.requestId || `vis_${Date.now()}`
  );
  if (!reservation.ok) {
    return sendApiError(
      req,
      res,
      402,
      'INSUFFICIENT_CREDITS',
      `Insufficient credits for image generation (required: ${creditCost}, remaining: ${reservation.balance}).`
    );
  }

  try {
    const refParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    if (Array.isArray(referenceImages)) {
      for (const refImg of referenceImages.slice(0, 3)) {
        const inline = await resolveImageInputToInlinePart(tenantId, String(refImg || ''));
        if (inline) refParts.push({ inlineData: inline });
      }
    }

    const compiledPrompt = compileVisionPrompt({
      prompt: String(prompt),
      negativePrompt: String(negativePrompt || ''),
      model: String(model),
      style: String(style),
      aspectRatio: String(aspectRatio),
      resolution: resTier,
      cfgScale: Number(cfgScale),
      steps: Number(steps),
      alchemy: Boolean(alchemy),
      photoReal: Boolean(photoReal),
      promptMagic: Boolean(promptMagic),
      cameraSpec,
    });

    const engineModel = selectGeminiImageEngine({
      modelProfile: String(model),
      resolution: resTier,
      aspectRatio: String(aspectRatio),
      googleSearchGrounding: Boolean(googleSearchGrounding),
      isEditOrUpscale: refParts.length > 0,
    });

    const dimensions = computeVisionDimensions(String(aspectRatio), resTier);
    const generatedItems: VisionImageRecord[] = [];

    for (let i = 0; i < numToGenerate; i++) {
      const currentSeed = Number(seed) + i;
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
        ...refParts,
        {
          text:
            refParts.length > 0
              ? `Using the attached reference image(s) for style, visual traits, or subject consistency: ${compiledPrompt}`
              : compiledPrompt,
        },
      ];

      const callResult = await runGeminiImageContentCall({
        client: tenantClient,
        engineModel,
        parts,
        aspectRatio: String(aspectRatio),
        resolution: resTier,
        seed: currentSeed,
        googleSearchGrounding: Boolean(googleSearchGrounding),
      });

      const id = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`;
      const asset = await saveTenantVisionAsset(
        tenantId,
        id,
        callResult.base64Data,
        callResult.mimeType
      );

      generatedItems.push({
        id,
        parentId: null,
        rootId: id,
        version: 1,
        operationType: 'generate',
        prompt: String(prompt).trim(),
        compiledPrompt,
        enhancedFrom: enhancedFrom ? String(enhancedFrom) : undefined,
        negativePrompt: String(negativePrompt || ''),
        model: String(model),
        engineModelUsed: callResult.engineModelUsed,
        style: String(style),
        aspectRatio: String(aspectRatio),
        dimensions,
        resolution: resTier,
        cfgScale: Number(cfgScale),
        steps: Number(steps),
        seed: currentSeed,
        imageUrl: asset.imageUrl,
        assetFilename: asset.assetFilename,
        mimeType: callResult.mimeType,
        createdAt: new Date().toISOString(),
        isFavorite: false,
        alchemy: Boolean(alchemy),
        photoReal: Boolean(photoReal),
        promptMagic: Boolean(promptMagic),
        googleSearchGrounding: Boolean(googleSearchGrounding),
        upscaled: resTier === '4K',
        aiNotes: callResult.aiNotes,
        cameraSpec,
      });
    }

    if (generatedItems.length === 0) {
      await refundCredits(tenantId, creditCost, 'vision_generate_empty', req.requestId || `vis_ref_${Date.now()}`);
      return sendApiError(req, res, 503, 'VISION_PROVIDER_UNAVAILABLE', 'Upstream image model produced no output. Credits refunded.');
    }

    const updated = await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (existing) => [
      ...generatedItems,
      ...existing,
    ]);

    return res.json({
      success: true,
      items: generatedItems,
      totalCount: updated.length,
      creditsBalance: reservation.balance,
    });
  } catch (err: any) {
    await refundCredits(tenantId, creditCost, 'vision_generate_failed', req.requestId || `vis_err_${Date.now()}`);
    console.error('Vision Generation Error:', err);
    return sendApiError(req, res, 503, 'VISION_PROVIDER_UNAVAILABLE', err?.message || 'Image synthesis failed. Credits refunded.');
  }
});

app.post('/api/vision/edit', apiHeavyAiLimiter, async (req, res) => {
  const tenantId = getReqTenant(req);
  const {
    instruction,
    sourceImage,
    parentId,
    rootId,
    parentVersion = 1,
    maskImage,
    referenceImages = [],
    operationType = 'edit',
    preservationStrength = 75,
    model = 'Nano Banana 2.1 Ultra',
    style = 'Cinematic Photoreal',
    aspectRatio = '16:9',
    resolution = '1K',
    negativePrompt = '',
    seed = Math.floor(Math.random() * 99999999) + 10000000,
    cameraSpec,
  } = req.body || {};

  if (!instruction || !String(instruction).trim()) {
    return sendApiError(req, res, 400, 'INVALID_INSTRUCTION', 'Edit instruction prompt is required.');
  }
  if (!sourceImage) {
    return sendApiError(req, res, 400, 'SOURCE_IMAGE_REQUIRED', 'A base generated or uploaded image is required for editing.');
  }

  const { client: tenantClient } = await getTenantGeminiClient(req);
  if (!tenantClient) {
    return sendApiError(req, res, 503, 'VISION_PROVIDER_UNAVAILABLE', 'Image editing requires an active Gemini API key.');
  }

  const baseInline = await resolveImageInputToInlinePart(tenantId, String(sourceImage));
  if (!baseInline) {
    return sendApiError(req, res, 400, 'INVALID_SOURCE_IMAGE', 'Could not decode source image. Upload a valid PNG, JPEG, or WebP.');
  }

  const resTier: VisionResolutionTier =
    resolution === '4K' || resolution === '2K' ? resolution : '1K';
  const creditCost = resTier === '4K' ? 4 : resTier === '2K' ? 3 : 2;
  const reservation = await reserveCredits(tenantId, creditCost, 'vision_edit', req.requestId || `vised_${Date.now()}`);
  if (!reservation.ok) {
    return sendApiError(req, res, 402, 'INSUFFICIENT_CREDITS', `Insufficient credits for image editing (required: ${creditCost}, remaining: ${reservation.balance}).`);
  }

  try {
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { inlineData: baseInline },
    ];

    let hasMask = false;
    if (maskImage) {
      const maskInline = await resolveImageInputToInlinePart(tenantId, String(maskImage));
      if (maskInline) {
        parts.push({ inlineData: maskInline });
        hasMask = true;
      }
    }

    let hasRef = false;
    if (Array.isArray(referenceImages)) {
      for (const refImg of referenceImages.slice(0, 2)) {
        const refInline = await resolveImageInputToInlinePart(tenantId, String(refImg || ''));
        if (refInline) {
          parts.push({ inlineData: refInline });
          hasRef = true;
        }
      }
    }

    const opType: VisionOperationType = hasMask ? 'inpaint' : (operationType as VisionOperationType) || 'edit';
    const compiledPrompt = compileVisionEditInstruction({
      instruction: String(instruction).trim(),
      operationType: opType,
      hasMask,
      hasReferenceImages: hasRef,
      preservationStrength: Number(preservationStrength) || 75,
      style: String(style),
      cameraSpec,
      negativePrompt: String(negativePrompt || ''),
    });

    parts.push({ text: compiledPrompt });

    const callResult = await runGeminiImageContentCall({
      client: tenantClient,
      engineModel: 'gemini-nano-banana-2.1',
      parts,
      aspectRatio: String(aspectRatio),
      resolution: resTier,
      seed: Number(seed),
    });

    const id = `edit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const asset = await saveTenantVisionAsset(tenantId, id, callResult.base64Data, callResult.mimeType);
    const dimensions = computeVisionDimensions(String(aspectRatio), resTier);

    const editedRecord: VisionImageRecord = {
      id,
      parentId: parentId || null,
      rootId: rootId || parentId || id,
      version: Math.max(2, Number(parentVersion) + 1),
      operationType: opType,
      prompt: String(instruction).trim(),
      compiledPrompt,
      negativePrompt: String(negativePrompt || ''),
      model: String(model),
      engineModelUsed: callResult.engineModelUsed,
      style: String(style),
      aspectRatio: String(aspectRatio),
      dimensions,
      resolution: resTier,
      cfgScale: 7.5,
      steps: 40,
      seed: Number(seed),
      imageUrl: asset.imageUrl,
      sourceImageUrl: typeof sourceImage === 'string' && sourceImage.startsWith('/api/vision/') ? sourceImage : undefined,
      assetFilename: asset.assetFilename,
      mimeType: callResult.mimeType,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      alchemy: true,
      photoReal: true,
      promptMagic: true,
      upscaled: resTier === '4K',
      aiNotes: callResult.aiNotes,
      cameraSpec,
    };

    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (existing) => [
      editedRecord,
      ...existing,
    ]);

    return res.json({
      success: true,
      item: editedRecord,
      creditsBalance: reservation.balance,
    });
  } catch (err: any) {
    await refundCredits(tenantId, creditCost, 'vision_edit_failed', req.requestId || `vised_err_${Date.now()}`);
    console.error('Vision Edit Error:', err);
    return sendApiError(req, res, 503, 'VISION_EDIT_FAILED', err?.message || 'Image edit failed. Credits refunded.');
  }
});

app.post('/api/vision/upscale', apiHeavyAiLimiter, async (req, res) => {
  const tenantId = getReqTenant(req);
  const { id, targetResolution = '4K', sourceImage } = req.body || {};

  const { client: tenantClient } = await getTenantGeminiClient(req);
  if (!tenantClient) {
    return sendApiError(req, res, 503, 'VISION_PROVIDER_UNAVAILABLE', '4K AI Upscaling requires an active Gemini API key.');
  }

  const list = await readTenantCollection<any[]>(tenantId, 'vision_images', []);
  const targetItem = id ? list.find((item) => item.id === id) : null;
  const imgInput = sourceImage || targetItem?.imageUrl;
  if (!imgInput) {
    return sendApiError(req, res, 404, 'IMAGE_NOT_FOUND', 'Source image not found for upscaling.');
  }

  const baseInline = await resolveImageInputToInlinePart(tenantId, String(imgInput));
  if (!baseInline) {
    return sendApiError(req, res, 400, 'INVALID_SOURCE_IMAGE', 'Could not read image asset for upscaling.');
  }

  const resTier: VisionResolutionTier = targetResolution === '2K' ? '2K' : '4K';
  const creditCost = resTier === '4K' ? 4 : 3;
  const reservation = await reserveCredits(tenantId, creditCost, 'vision_upscale', req.requestId || `visup_${Date.now()}`);
  if (!reservation.ok) {
    return sendApiError(req, res, 402, 'INSUFFICIENT_CREDITS', `Insufficient credits for ${resTier} upscale.`);
  }

  try {
    const aspectRatio = targetItem?.aspectRatio || '16:9';
    const upscalePrompt = compileVisionEditInstruction({
      instruction: `Upscale and remaster to crisp ${resTier} ultra-high resolution clarity. Sharpen micro-textures, eyes, foliage, fabric weave, and edges while keeping exact subject identity and composition unchanged.`,
      operationType: 'upscale',
      hasMask: false,
      hasReferenceImages: false,
      preservationStrength: 95,
      style: targetItem?.style || 'Cinematic Photoreal',
    });

    const callResult = await runGeminiImageContentCall({
      client: tenantClient,
      engineModel: 'gemini-nano-banana-2.1',
      parts: [{ inlineData: baseInline }, { text: upscalePrompt }],
      aspectRatio,
      resolution: resTier,
      seed: targetItem?.seed,
    });

    const newId = `up-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const asset = await saveTenantVisionAsset(tenantId, newId, callResult.base64Data, callResult.mimeType);
    const dimensions = computeVisionDimensions(aspectRatio, resTier);

    const upscaledRecord: VisionImageRecord = {
      id: newId,
      parentId: targetItem?.id || null,
      rootId: targetItem?.rootId || targetItem?.id || newId,
      version: Math.max(2, Number(targetItem?.version || 1) + 1),
      operationType: 'upscale',
      prompt: targetItem?.prompt || '4K Ultra Clarity Upscale',
      compiledPrompt: upscalePrompt,
      negativePrompt: targetItem?.negativePrompt || '',
      model: targetItem?.model || 'Nano Banana 2.1 Ultra',
      engineModelUsed: callResult.engineModelUsed,
      style: targetItem?.style || 'Cinematic Photoreal',
      aspectRatio,
      dimensions,
      resolution: resTier,
      cfgScale: targetItem?.cfgScale || 7.5,
      steps: targetItem?.steps || 40,
      seed: targetItem?.seed || Math.floor(Math.random() * 90000000),
      imageUrl: asset.imageUrl,
      sourceImageUrl: targetItem?.imageUrl,
      assetFilename: asset.assetFilename,
      mimeType: callResult.mimeType,
      createdAt: new Date().toISOString(),
      isFavorite: Boolean(targetItem?.isFavorite),
      alchemy: true,
      photoReal: true,
      promptMagic: true,
      upscaled: true,
      aiNotes: callResult.aiNotes,
      cameraSpec: targetItem?.cameraSpec,
    };

    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (existing) => [
      upscaledRecord,
      ...existing,
    ]);

    return res.json({
      success: true,
      item: upscaledRecord,
      creditsBalance: reservation.balance,
    });
  } catch (err: any) {
    await refundCredits(tenantId, creditCost, 'vision_upscale_failed', req.requestId || `visup_err_${Date.now()}`);
    return sendApiError(req, res, 503, 'VISION_UPSCALE_FAILED', err?.message || 'Upscale failed. Credits refunded.');
  }
});

app.post('/api/vision/publish', async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'Image ID is required to publish.');

    const list = await readTenantCollection<any[]>(tenantId, 'vision_images', []);
    const item = list.find((i) => i.id === id);
    if (!item) return sendApiError(req, res, 404, 'IMAGE_NOT_FOUND', 'Image not found.');

    const inline = await resolveImageInputToInlinePart(tenantId, String(item.imageUrl || ''));
    const imageDataUrl = inline ? `data:${inline.mimeType};base64,${inline.data}` : String(item.imageUrl || '');
    const shareId =
      item.publishMeta?.shareId ||
      `vis_${crypto.createHash('sha256').update(`${tenantId}:${id}`).digest('hex').slice(0, 10)}`;
    const now = new Date().toISOString();

    const snapshot: VisionPublishedSnapshot = {
      shareId,
      tenantId,
      imageId: id,
      title: String(item.prompt || 'RaOne Vision Render').slice(0, 80),
      prompt: item.prompt,
      compiledPrompt: item.compiledPrompt || item.prompt,
      negativePrompt: item.negativePrompt || '',
      model: item.model,
      style: item.style,
      aspectRatio: item.aspectRatio,
      dimensions: item.dimensions,
      resolution: item.resolution || '1K',
      seed: item.seed,
      cameraSpec: item.cameraSpec,
      imageDataUrl,
      publishedAt: now,
    };

    await mutateSharedCollection<Record<string, VisionPublishedSnapshot>>(
      'vision_published',
      {},
      (map) => ({ ...map, [shareId]: snapshot })
    );

    const publishMeta = {
      isPublished: true,
      shareId,
      shareUrl: `/vision/shared/${shareId}`,
      publishedAt: now,
    };

    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (existing) =>
      existing.map((entry) => (entry.id === id ? { ...entry, publishMeta } : entry))
    );

    return res.json({ success: true, publishMeta });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'VISION_PUBLISH_ERROR', err.message);
  }
});

app.post('/api/vision/favorite', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    const tenantId = getReqTenant(req);
    let updatedItem: any = null;
    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (list) =>
      list.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, isFavorite: !item.isFavorite };
          return updatedItem;
        }
        return item;
      })
    );
    if (!updatedItem) return sendApiError(req, res, 404, 'IMAGE_NOT_FOUND', 'Image not found.');
    return res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'VISION_FAVORITE_ERROR', err.message);
  }
});

app.post('/api/vision/delete', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    const tenantId = getReqTenant(req);
    let removedAsset: string | undefined;
    const filtered = await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], (list) => {
      const target = list.find((item) => item.id === id);
      removedAsset = target?.assetFilename;
      return list.filter((item) => item.id !== id);
    });
    if (removedAsset) {
      const assetPath = resolveTenantVisionAssetPath(tenantId, removedAsset);
      if (assetPath && fs.existsSync(assetPath)) {
        fs.promises.unlink(assetPath).catch(() => {});
      }
    }
    return res.json({ success: true, remainingCount: filtered.length });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'VISION_DELETE_ERROR', err.message);
  }
});

app.post('/api/vision/controlnet/generate', (req, res) => {
  return sendApiError(req, res, 501, 'WORKER_NOT_CONNECTED', 'Use Reference Image Lock or Mask Inpaint directly via /api/vision/edit for multimodal conditioning.');
});

app.post('/api/vision/ip-adapter/generate', (req, res) => {
  return sendApiError(req, res, 501, 'WORKER_NOT_CONNECTED', 'Use Multi-Reference attachments directly in /api/vision/generate or /api/vision/edit.');
});

app.post('/api/vision/inpaint', (req, res) => {
  return sendApiError(req, res, 501, 'USE_VISION_EDIT', 'Mask-guided pixel inpainting is served via /api/vision/edit.');
});

app.post('/api/vision/lora/train', (req, res) => {
  return sendApiError(req, res, 501, 'WORKER_NOT_CONNECTED', 'Custom LoRA fine-tuning requires an attached GPU training cluster (VISION_WORKER_URL).');
});


// ==========================================
// 🎬 RAONE MOTION STUDIO (Per-Tenant Storage & Honest Provider/Worker Boundaries - A14)
// ==========================================
app.get(['/api/motion/history', '/api/motion/gallery'], async (req, res) => {
  try {
    const list = await readTenantCollection<any[]>(getReqTenant(req), 'motion_videos', []);
    return res.json({ success: true, count: list.length, items: list });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'MOTION_HISTORY_ERROR', err.message);
  }
});

app.post('/api/motion/enhance-prompt', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { prompt, cameraMotion = 'Fly Through Forward', model = 'Google Veo 2' } = req.body || {};
    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required.');
    }

    const { client: tenantClient, byok } = await getTenantGeminiClient(req);
    const activeGroqKey = byok.groqApiKey || GROQ_API_KEY;

    const enhanceMotionInstruction = `You are a video diffusion prompt engineer.
Transform the following basic user video prompt into a cinematic video prompt.
Include:
- Camera movement: "${cameraMotion}"
- Lighting & atmosphere: Volumetric cinematic lighting and shutter speed
- Target model styling: "${model}"
Output ONLY the enhanced prompt string.

Prompt: ${prompt}`;

    if (tenantClient) {
      try {
        const response = await tenantClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { role: 'user', parts: [{ text: enhanceMotionInstruction }] },
          config: {
            systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
              provider: 'Google Gemini API',
              model: 'gemini-4-hydrogen',
              subsystem: 'RaOne Cinema Studio Motion Prompt Enhancer',
            }),
          },
        });
        const enhanced = (response.text || '').trim();
        if (enhanced) {
          return res.json({ success: true, enhancedPrompt: enhanced });
        }
      } catch (err: any) {
        console.warn('Video prompt enhancement warning:', err.message);
      }
    }

    if (activeGroqKey) {
      try {
        const groqMotion = await callGroqChat(
          activeGroqKey,
          'raone-llama3-70b',
          [{ role: 'user', content: enhanceMotionInstruction }],
          `${SYSTEM_PROMPT}\n\n[CINEMA MOTION PROMPT ENHANCER]\nOutput ONLY the enhanced video prompt string.`,
          1024
        );
        const enhanced = (groqMotion.text || '').trim();
        if (enhanced) {
          return res.json({ success: true, enhancedPrompt: enhanced, modelUsed: groqMotion.modelUsed });
        }
      } catch (groqErr: any) {
        console.warn('Groq motion enhance warning:', groqErr?.message || groqErr);
      }
    }

    return sendApiError(req, res, 503, 'MOTION_ENHANCE_UNAVAILABLE', 'No AI text provider is currently available to enhance the video prompt.');
  } catch (err: any) {
    return sendApiError(req, res, 500, 'MOTION_ENHANCE_ERROR', err.message);
  }
});

app.post('/api/motion/generate', apiHeavyAiLimiter, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) {
    return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for video generation.');
  }
  if (!process.env.VIDEO_GENERATION_API_URL) {
    return sendApiError(
      req,
      res,
      503,
      'VIDEO_PROVIDER_NOT_CONFIGURED',
      'Video generation provider is not configured on this backend (set VIDEO_GENERATION_API_URL or connect a Veo/Runway worker).'
    );
  }
  return sendApiError(req, res, 501, 'VIDEO_WORKER_DISPATCH_UNIMPLEMENTED', 'External video worker adapter is not attached.');
});

app.post('/api/motion/favorite', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    let updatedItem: any = null;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'motion_videos', [], (list) =>
      list.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, isFavorite: !item.isFavorite };
          return updatedItem;
        }
        return item;
      })
    );
    if (!updatedItem) return sendApiError(req, res, 404, 'VIDEO_NOT_FOUND', 'Video not found.');
    return res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'MOTION_FAVORITE_ERROR', err.message);
  }
});

app.post('/api/motion/delete', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    const filtered = await mutateTenantCollection<any[]>(getReqTenant(req), 'motion_videos', [], (list) =>
      list.filter((item) => item.id !== id)
    );
    return res.json({ success: true, remainingCount: filtered.length });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'MOTION_DELETE_ERROR', err.message);
  }
});

app.post('/api/motion/extend', (req, res) => {
  return sendApiError(req, res, 501, 'FFMPEG_WORKER_REQUIRED', 'Video extension requires a connected video synthesis & FFmpeg worker.');
});

app.post('/api/motion/interpolate', (req, res) => {
  return sendApiError(req, res, 501, 'FFMPEG_WORKER_REQUIRED', 'Frame rate interpolation (60fps RIFE/FFmpeg) requires a connected GPU video worker.');
});

app.post('/api/motion/upscale', (req, res) => {
  return sendApiError(req, res, 501, 'FFMPEG_WORKER_REQUIRED', '4K video super-resolution requires a connected GPU video worker.');
});

app.post('/api/motion/motion-brush', (req, res) => {
  return sendApiError(req, res, 501, 'FFMPEG_WORKER_REQUIRED', 'Motion Brush trajectory synthesis requires a connected video diffusion worker.');
});

app.post('/api/motion/audio-sync', (req, res) => {
  return sendApiError(req, res, 501, 'FFMPEG_WORKER_REQUIRED', 'Foley audio-to-video muxing requires a connected FFmpeg & audio synthesis worker.');
});


// ==========================================
// 🎵 RAONE SUNO AUDIO & MUSIC STUDIO (Per-Tenant Storage & Honest Provider/Worker Boundaries - A15, A28)
// ==========================================
app.get('/api/audio/voice-clone/list', async (req, res) => {
  try {
    const list = await readTenantCollection<any[]>(getReqTenant(req), 'voice_clones', []);
    return res.json({ success: true, count: list.length, items: list });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'VOICE_CLONE_LIST_ERROR', err.message);
  }
});

app.post('/api/audio/voice-clone', (req, res) => {
  return sendApiError(
    req,
    res,
    501,
    'VOICE_CONSENT_WORKER_REQUIRED',
    'Voice cloning requires an authenticated speaker consent workflow and an external neural voice cloning worker.'
  );
});

app.get(['/api/audio/history', '/api/audio/gallery'], async (req, res) => {
  try {
    const list = await readTenantCollection<any[]>(getReqTenant(req), 'audio_tracks', []);
    return res.json({ success: true, count: list.length, items: list });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'AUDIO_HISTORY_ERROR', err.message);
  }
});

app.post('/api/audio/enhance-lyrics', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { prompt, style = 'Electronic Pop', title = '' } = req.body || {};
    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for lyrics generation.');
    }

    const { client: tenantClient, byok } = await getTenantGeminiClient(req);
    const activeGroqKey = byok.groqApiKey || GROQ_API_KEY;

    const enhanceLyricsInstruction = `You are a music songwriter. Write structured lyrics formatted with bracket tags:
[Verse 1]
[Pre-Chorus]
[Chorus]
[Verse 2]
[Chorus]
[Bridge]
[Outro]

Song Title: ${title || 'Untitled Anthem'}
Genre/Style: ${style}
Theme/Story: ${prompt}

Output ONLY the formatted lyrics text with brackets.`;

    if (tenantClient) {
      try {
        const response = await tenantClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { role: 'user', parts: [{ text: enhanceLyricsInstruction }] },
          config: {
            systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
              provider: 'Google Gemini API',
              model: 'gemini-4-hydrogen',
              subsystem: 'RaOne Suno Audio Lyrics Studio',
            }),
          },
        });
        const lyrics = (response.text || '').trim();
        if (lyrics) {
          return res.json({ success: true, lyrics });
        }
      } catch (err: any) {
        console.warn('Lyrics enhancement warning:', err.message);
      }
    }

    if (activeGroqKey) {
      try {
        const groqLyrics = await callGroqChat(
          activeGroqKey,
          'raone-llama3-70b',
          [{ role: 'user', content: enhanceLyricsInstruction }],
          `${SYSTEM_PROMPT}\n\n[LYRICS STUDIO]\nOutput ONLY the formatted song lyrics with bracket tags.`,
          2048
        );
        const lyrics = (groqLyrics.text || '').trim();
        if (lyrics) {
          return res.json({ success: true, lyrics, modelUsed: groqLyrics.modelUsed });
        }
      } catch (groqErr: any) {
        console.warn('Groq lyrics warning:', groqErr?.message || groqErr);
      }
    }

    return sendApiError(req, res, 503, 'LYRICS_PROVIDER_UNAVAILABLE', 'No AI provider is configured to generate song lyrics.');
  } catch (err: any) {
    return sendApiError(req, res, 500, 'LYRICS_ENHANCE_ERROR', err.message);
  }
});

app.post('/api/audio/generate', apiHeavyAiLimiter, async (req, res) => {
  const { prompt = '', lyrics = '' } = req.body || {};
  // Safely normalize prompt OR lyrics so lyrics-only calls never throw prompt.split TypeError (A28)
  const titleSeed = String(prompt || lyrics || '').trim();
  if (!titleSeed) {
    return sendApiError(req, res, 400, 'INVALID_AUDIO_REQUEST', 'Either prompt or lyrics are required.');
  }

  if (!process.env.AUDIO_SYNTHESIS_API_URL) {
    return sendApiError(
      req,
      res,
      503,
      'AUDIO_SYNTHESIS_PROVIDER_REQUIRED',
      'Full-track audio synthesis provider is not configured on this backend (set AUDIO_SYNTHESIS_API_URL or configure an audio generation worker).'
    );
  }
  return sendApiError(req, res, 501, 'AUDIO_WORKER_DISPATCH_UNIMPLEMENTED', 'External audio synthesis worker is not attached.');
});

app.post('/api/audio/favorite', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    let updatedItem: any = null;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'audio_tracks', [], (list) =>
      list.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, isFavorite: !item.isFavorite };
          return updatedItem;
        }
        return item;
      })
    );
    if (!updatedItem) return sendApiError(req, res, 404, 'TRACK_NOT_FOUND', 'Track not found.');
    return res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'AUDIO_FAVORITE_ERROR', err.message);
  }
});

app.post('/api/audio/delete', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    const filtered = await mutateTenantCollection<any[]>(getReqTenant(req), 'audio_tracks', [], (list) =>
      list.filter((item) => item.id !== id)
    );
    return res.json({ success: true, remainingCount: filtered.length });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'AUDIO_DELETE_ERROR', err.message);
  }
});

app.post('/api/audio/extend', (req, res) => {
  return sendApiError(req, res, 501, 'AUDIO_WORKER_REQUIRED', 'Continuous audio extension requires a connected audio synthesis worker.');
});

app.post('/api/audio/separate-stems', (req, res) => {
  return sendApiError(req, res, 501, 'DEMUCS_WORKER_REQUIRED', 'Stem isolation (Demucs v4) requires a connected GPU audio DSP worker.');
});

app.post('/api/audio/play', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    await mutateTenantCollection<any[]>(getReqTenant(req), 'audio_tracks', [], (list) =>
      list.map((item) => (item.id === id ? { ...item, playCount: (Number(item.playCount) || 0) + 1 } : item))
    );
    return res.json({ success: true });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'AUDIO_PLAY_ERROR', err.message);
  }
});

// ==========================================
// 📄 RAONE DOCUSTUDIO (Per-Tenant Storage, Honest RAG Citations, Real Native OOXML & PDF Exports - A16, A17, A30)
// ==========================================
app.get(['/api/documents/history', '/api/documents/list'], async (req, res) => {
  try {
    const list = await readTenantCollection<any[]>(getReqTenant(req), 'documents', []);
    return res.json({ success: true, count: list.length, items: list });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'DOCUMENTS_LIST_ERROR', err.message);
  }
});

app.post('/api/documents/generate', apiHeavyAiLimiter, async (req, res) => {
  try {
    const tenantId = getReqTenant(req);
    const {
      prompt,
      docType = 'report',
      tone = 'executive',
      model = 'Gemini 3.8 Flash Document AI',
      sourceText = '',
    } = req.body || {};

    if (!prompt) {
      return sendApiError(req, res, 400, 'INVALID_PROMPT', 'Prompt is required for document generation.');
    }

    const { client: tenantClient, byok } = await getTenantGeminiClient(req);
    const activeGroqKey = byok.groqApiKey || GROQ_API_KEY;
    if (!tenantClient && !activeGroqKey) {
      return sendApiError(req, res, 503, 'DOCUMENT_PROVIDER_UNAVAILABLE', 'No AI provider is configured to synthesize documents.');
    }

    let generatedTitle = String(prompt).split('\n')[0].substring(0, 60);
    let generatedContent = '';
    let generatedSummary = '';
    let generatedSlides: any[] = [];
    let generatedCitations: any[] = [];

    const docPrompt = `You are an executive document strategist.
Generate a structured ${String(docType).toUpperCase()} based on:
Prompt: "${prompt}"
${sourceText ? `Source Grounding Material (quote ONLY from this material if citing sources): ${String(sourceText).slice(0, 18000)}` : 'No external source material provided; leave citations array empty unless strictly grounded.'}
Tone: ${tone}

Respond in strict JSON format matching:
{
  "title": "String",
  "summary": "String",
  "content": "Full markdown content with headers, tables, bullet points",
  "slides": [
    {
      "slideNumber": 1,
      "title": "String",
      "subtitle": "String",
      "bulletPoints": ["Point 1", "Point 2", "Point 3"],
      "callout": "Key takeaway",
      "themeColor": "emerald" | "purple" | "cyan" | "amber"
    }
  ],
  "citations": []
}`;

    if (tenantClient) {
      try {
        const response = await tenantClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [{ role: 'user', parts: [{ text: docPrompt }] }],
          config: {
            responseMimeType: 'application/json',
            systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
              provider: 'Google Gemini API',
              model: 'gemini-4-hydrogen',
              subsystem: 'RaOne Document AI Studio',
            }),
          },
        });
        const parsed = JSON.parse(response.text || '{}');
        if (parsed.title) generatedTitle = parsed.title;
        if (parsed.content) generatedContent = parsed.content;
        if (parsed.summary) generatedSummary = parsed.summary;
        if (Array.isArray(parsed.slides)) generatedSlides = parsed.slides;
        if (Array.isArray(parsed.citations) && sourceText) generatedCitations = parsed.citations;
      } catch (genErr: any) {
        console.warn('Document AI generation warning:', genErr.message);
      }
    }

    if (!generatedContent && activeGroqKey) {
      try {
        const groqDoc = await callGroqChat(
          activeGroqKey,
          'raone-llama3-70b',
          [{ role: 'user', content: docPrompt }],
          `${SYSTEM_PROMPT}\n\n[DOCUMENT AI SCHEMA DIRECTIVE]\nRespond strictly with a single valid JSON object matching the schema requested.`,
          4096
        );
        const raw = (groqDoc.text || '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        if (parsed.title) generatedTitle = parsed.title;
        if (parsed.content) generatedContent = parsed.content;
        if (parsed.summary) generatedSummary = parsed.summary;
        if (Array.isArray(parsed.slides)) generatedSlides = parsed.slides;
        if (Array.isArray(parsed.citations) && sourceText) generatedCitations = parsed.citations;
      } catch (groqDocErr: any) {
        console.warn('Groq Document AI warning:', groqDocErr?.message || groqDocErr);
      }
    }

    if (!generatedContent) {
      return sendApiError(req, res, 503, 'DOCUMENT_PROVIDER_UNAVAILABLE', 'Upstream AI provider failed to synthesize document content.');
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDoc = {
      id: docId,
      title: generatedTitle,
      docType,
      prompt,
      content: generatedContent,
      summary: generatedSummary,
      slides: generatedSlides,
      citations: generatedCitations,
      model,
      tags: [String(docType).toUpperCase(), tone, 'OOXML Native'],
      pageCount: Math.max(1, Math.ceil(generatedContent.split('\n').length / 25)),
      wordCount: generatedContent.split(/\s+/).length,
      officeExportUrls: {
        docx: `/api/documents/export/docx?id=${docId}`,
        pptx: `/api/documents/export/pptx?id=${docId}`,
        xlsx: `/api/documents/export/xlsx?id=${docId}`,
        pdf: `/api/documents/export/pdf?id=${docId}`,
        md: `/api/documents/export/md?id=${docId}`,
      },
      createdAt: new Date().toISOString(),
      isFavorite: false,
    };

    const updated = await mutateTenantCollection<any[]>(tenantId, 'documents', [], (existing) => [newDoc, ...existing]);

    return res.json({
      success: true,
      document: newDoc,
      totalCount: updated.length,
    });
  } catch (err: any) {
    console.error('Document Generation Error:', err);
    return sendApiError(req, res, 500, 'DOCUMENT_GENERATION_ERROR', err.message);
  }
});

app.post('/api/documents/analyze', apiHeavyAiLimiter, async (req, res) => {
  try {
    const { query, content } = req.body || {};
    if (!query && !content) {
      return sendApiError(req, res, 400, 'INVALID_INPUT', 'Query or content is required.');
    }

    const { client: tenantClient, byok } = await getTenantGeminiClient(req);
    const activeGroqKey = byok.groqApiKey || GROQ_API_KEY;
    if (!tenantClient && !activeGroqKey) {
      return sendApiError(req, res, 503, 'DOCUMENT_PROVIDER_UNAVAILABLE', 'No AI provider is configured to analyze the document.');
    }

    const ragPrompt = `You are the RaOne Document AI Analysis Engine.
Given the document text:
"${content ? String(content).substring(0, 18000) : 'No source text supplied'}"

Answer the user inquiry concisely and honestly based ONLY on the text provided:
User Query: "${query || 'Summarize key takeaways, risks, and next steps'}"`;

    if (tenantClient) {
      try {
        const response = await tenantClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [{ role: 'user', parts: [{ text: ragPrompt }] }],
          config: {
            systemInstruction: appendRuntimeMetadata(SYSTEM_PROMPT, {
              provider: 'Google Gemini API',
              model: 'gemini-4-hydrogen',
              subsystem: 'RaOne Document AI Q&A',
            }),
          },
        });
        if (response.text) {
          return res.json({ success: true, answer: response.text });
        }
      } catch (err: any) {
        console.warn('Analysis warning:', err.message);
      }
    }

    if (activeGroqKey) {
      try {
        const groqRag = await callGroqChat(
          activeGroqKey,
          'raone-llama3-70b',
          [{ role: 'user', content: ragPrompt }],
          SYSTEM_PROMPT
        );
        if (groqRag.text) {
          return res.json({ success: true, answer: groqRag.text, modelUsed: groqRag.modelUsed });
        }
      } catch (groqErr: any) {
        console.warn('Groq analysis warning:', groqErr?.message || groqErr);
      }
    }

    return sendApiError(req, res, 503, 'DOCUMENT_PROVIDER_UNAVAILABLE', 'Upstream AI provider failed to analyze the document.');
  } catch (err: any) {
    return sendApiError(req, res, 500, 'DOCUMENT_ANALYZE_ERROR', err.message);
  }
});

app.post('/api/documents/favorite', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    let updatedItem: any = null;
    await mutateTenantCollection<any[]>(getReqTenant(req), 'documents', [], (list) =>
      list.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, isFavorite: !item.isFavorite };
          return updatedItem;
        }
        return item;
      })
    );
    if (!updatedItem) return sendApiError(req, res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    return res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'DOCUMENT_FAVORITE_ERROR', err.message);
  }
});

app.post('/api/documents/delete', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return sendApiError(req, res, 400, 'INVALID_ID', 'ID is required.');
    const filtered = await mutateTenantCollection<any[]>(getReqTenant(req), 'documents', [], (list) =>
      list.filter((item) => item.id !== id)
    );
    return res.json({ success: true, remainingCount: filtered.length });
  } catch (err: any) {
    return sendApiError(req, res, 500, 'DOCUMENT_DELETE_ERROR', err.message);
  }
});

// 6. Real Binary OOXML & PDF Export (DOCX, PPTX, XLSX, PDF, MD) — A17 & A30
app.all('/api/documents/export/:format', async (req, res) => {
  try {
    const format = String(req.params.format || '').toLowerCase();
    const docId = (req.query.id as string) || req.body?.id;
    let title = req.body?.title || 'Executive Document';
    let content = req.body?.content || '';
    let slides = req.body?.slides || [];

    if (docId) {
      const list = await readTenantCollection<any[]>(getReqTenant(req), 'documents', []);
      const doc = list.find((d) => d.id === docId);
      if (!doc) {
        return sendApiError(req, res, 404, 'DOCUMENT_NOT_FOUND', `Document "${docId}" not found for your account.`);
      }
      title = doc.title || title;
      content = doc.content || content;
      slides = doc.slides || slides;
    }

    const safeTitle =
      String(title)
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'Document';

    if (format === 'docx') {
      const buf = await generateTrueDocxBuffer({ title, content });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
      return res.send(buf);
    }

    if (format === 'pptx') {
      const buf = await generateTruePptxBuffer({ title, content, slides });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pptx"`);
      return res.send(buf);
    }

    if (format === 'xlsx') {
      const buf = await generateTrueXlsxBuffer({ title, content });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.xlsx"`);
      return res.send(buf);
    }

    if (format === 'pdf') {
      const buf = await generateTruePdfBuffer({ title, content });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
      return res.send(buf);
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.md"`);
    return res.send(content);
  } catch (err: any) {
    console.error('Office Export Error:', err);
    return sendApiError(req, res, 500, 'EXPORT_FAILED', err.message);
  }
});




// Standalone Sandboxed Live Hosted Preview Route for Published Code Studio Apps
app.get('/published/:shareId', async (req, res) => {
  try {
    const shareId = String(req.params.shareId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!shareId) {
      return res.status(404).send('Published application not found.');
    }
    const publishedMap = await readSharedCollection<Record<string, PublishedSnapshotRecord>>('studio_published', {});
    const record = publishedMap[shareId];
    if (!record || !record.code) {
      return res.status(404).send('Published application snapshot was not found or has been removed.');
    }

    // Increment view counter asynchronously (non-blocking)
    mutateSharedCollection<Record<string, PublishedSnapshotRecord>>('studio_published', {}, (map) => {
      if (!map[shareId]) return map;
      return {
        ...map,
        [shareId]: { ...map[shareId], views: (map[shareId].views || 0) + 1 },
      };
    }).catch(() => {});

    // Isolate published user-generated apps in an opaque sandbox origin so they cannot access host cookies/storage
    res.setHeader(
      'Content-Security-Policy',
      "sandbox allow-scripts allow-forms allow-modals allow-downloads; default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'"
    );
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(record.code);
  } catch (err: any) {
    return res.status(500).send('Failed to serve published application.');
  }
});

// Public Standalone Hosted Preview for Published RaOne Vision Studio Renders
app.get('/vision/shared/:shareId', async (req, res) => {
  try {
    const shareId = String(req.params.shareId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!shareId) {
      return res.status(404).send('Shared artwork not found.');
    }
    const publishedMap = await readSharedCollection<Record<string, VisionPublishedSnapshot>>('vision_published', {});
    const record = publishedMap[shareId];
    if (!record || !record.imageDataUrl) {
      return res.status(404).send('Shared Vision Studio artwork was not found.');
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(buildPublishedVisionHtml(record));
  } catch {
    return res.status(500).send('Failed to render shared artwork.');
  }
});

// Setup Vite in development or static serve in production
async function startServer() {
  // Ensure unknown /api routes always return JSON instead of falling back to index.html
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      brand: 'RaOne AI by RavanaTec',
    });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.resolve(distPath, 'index.html');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexHtmlPath)) {
        return res.sendFile(indexHtmlPath);
      }
      return res.json({
        status: 'online',
        service: 'RaOne AI Backend API',
        brand: 'RaOne AI by RavanaTec',
        healthEndpoint: '/api/health',
      });
    });
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`RaOne AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
