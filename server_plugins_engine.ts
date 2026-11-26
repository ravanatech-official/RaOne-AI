import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import {
  encryptSecret,
  decryptSecret,
  validatePluginHeaderName,
  validatePluginHealthPath,
} from './server_security.ts';
import {
  readTenantCollection,
  mutateTenantCollection,
  getTenantByokKeys,
  saveTenantByokKeys,
  type ByokKeyMap,
} from './server_tenant_store.ts';
import {
  validateLocalLlmEndpoint,
  fetchOpenAiCompatibleModels,
} from './server_local_llm.ts';
import type {
  CustomPluginDefinition,
  PluginCatalogEntry,
  PluginCategory,
  PluginLibraryStats,
  PluginPublicView,
  PluginStudioScope,
} from './src/types/plugins.ts';

// =========================================================================
// Official Silicon Valley Plugins Catalog (30 Connectors Across 5 Studios)
// =========================================================================
export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  // --- 1. CODE & CLOUD STUDIO ---
  {
    id: 'github',
    name: 'GitHub',
    provider: 'GitHub Inc.',
    category: 'code',
    description: 'Push full-stack projects, generate CI/CD workflows, and sync repositories directly from Code Studio.',
    shortTag: 'Git & CI/CD',
    studios: ['code', 'document'],
    authType: 'pat',
    docsUrl: 'https://docs.github.com/en/authentication',
    getKeyUrl: 'https://github.com/settings/tokens?type=beta',
    capabilities: ['One-click Repo Push', 'GitHub Actions CI/CD', 'Branch Sync'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token (PAT)',
        type: 'secret',
        placeholder: 'ghp_... or github_pat_...',
        required: true,
        helper: 'Needs repo write scope for direct Code Studio commits.',
      },
      {
        key: 'defaultOwner',
        label: 'Default Owner / Org (Optional)',
        type: 'text',
        placeholder: 'ravanatech',
        required: false,
      },
    ],
  },
  {
    id: 'firebase',
    name: 'Firebase & Google Cloud',
    provider: 'Google Cloud',
    category: 'code',
    description: 'Bind Firebase Project IDs, Cloud Run regions, and service tokens for Firestore rules & hosting deploys.',
    shortTag: 'Cloud & DB',
    studios: ['code', 'document'],
    authType: 'api_key',
    docsUrl: 'https://firebase.google.com/docs',
    getKeyUrl: 'https://console.firebase.google.com/',
    capabilities: ['Hosting Targets', 'Firestore Schema Sync', 'Cloud Run Config'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'projectId',
        label: 'Firebase / GCP Project ID',
        type: 'text',
        placeholder: 'raoneai-prod',
        required: true,
      },
      {
        key: 'webApiKey',
        label: 'Firebase Web API Key or CI Token',
        type: 'secret',
        placeholder: 'AIzaSy... or 1//0...',
        required: false,
      },
      {
        key: 'region',
        label: 'Preferred Cloud Region',
        type: 'text',
        placeholder: 'us-central1',
        required: false,
      },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    provider: 'Vercel Inc.',
    category: 'code',
    description: 'Verify your Vercel account & team scope for edge frontend deployments and preview URLs.',
    shortTag: 'Edge Deploy',
    studios: ['code'],
    authType: 'api_key',
    docsUrl: 'https://vercel.com/docs/rest-api',
    getKeyUrl: 'https://vercel.com/account/tokens',
    capabilities: ['Edge Preview Deploys', 'Team Scope Linking', 'Build Webhooks'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'token',
        label: 'Vercel Access Token',
        type: 'secret',
        placeholder: 'vcel_...',
        required: true,
      },
      {
        key: 'teamId',
        label: 'Team ID (Optional)',
        type: 'text',
        placeholder: 'team_...',
        required: false,
      },
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    provider: 'Supabase Inc.',
    category: 'code',
    description: 'Connect managed Postgres REST & Auth endpoints for full-stack apps generated in Code Studio.',
    shortTag: 'Postgres & Auth',
    studios: ['code'],
    authType: 'api_key',
    docsUrl: 'https://supabase.com/docs/guides/api',
    getKeyUrl: 'https://supabase.com/dashboard',
    capabilities: ['PostgREST Endpoint', 'Auth Integration', 'Storage Buckets'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'projectUrl',
        label: 'Supabase Project URL',
        type: 'url',
        placeholder: 'https://xyzcompany.supabase.co',
        required: true,
      },
      {
        key: 'anonKey',
        label: 'Anon / Service Role Key',
        type: 'secret',
        placeholder: 'eyJhbGciOiJIUzI1NiIs...',
        required: true,
      },
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers & R2',
    provider: 'Cloudflare',
    category: 'code',
    description: 'Authenticate Cloudflare API tokens for edge workers, Pages deploys, and zero-egress R2 object storage.',
    shortTag: 'Edge & R2',
    studios: ['code', 'vision', 'cinema'],
    authType: 'api_key',
    docsUrl: 'https://developers.cloudflare.com/api/',
    getKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    capabilities: ['Token Verification', 'Workers KV / R2', 'CDN Purge'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiToken',
        label: 'Cloudflare API Token',
        type: 'secret',
        placeholder: 'cf_token_...',
        required: true,
      },
      {
        key: 'accountId',
        label: 'Account ID (Optional)',
        type: 'text',
        placeholder: '32-char hex account ID',
        required: false,
      },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    provider: 'Stripe Inc.',
    category: 'code',
    description: 'Verify live or test Stripe secret keys when scaffolding SaaS checkout, subscriptions, and webhooks.',
    shortTag: 'SaaS Billing',
    studios: ['code'],
    authType: 'api_key',
    docsUrl: 'https://stripe.com/docs/api',
    getKeyUrl: 'https://dashboard.stripe.com/apikeys',
    capabilities: ['Live Key Balance Check', 'Checkout Scaffolding', 'Webhook Signing'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'secretKey',
        label: 'Stripe Secret Key',
        type: 'secret',
        placeholder: 'sk_test_... or sk_live_...',
        required: true,
      },
      {
        key: 'publishableKey',
        label: 'Publishable Key (Optional)',
        type: 'text',
        placeholder: 'pk_test_... or pk_live_...',
        required: false,
      },
    ],
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL / Neon / Redis',
    provider: 'PostgreSQL / Upstash',
    category: 'code',
    description: 'Store an encrypted external SQL or Redis connection URI for backend scaffolding and migration scripts.',
    shortTag: 'SQL & Cache',
    studios: ['code'],
    authType: 'endpoint',
    docsUrl: 'https://neon.tech/docs/introduction',
    capabilities: ['Encrypted URI Vault', 'DNS Reachability Check', 'ORM Context'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'connectionUri',
        label: 'Database Connection URI',
        type: 'secret',
        placeholder: 'postgresql://user:pass@ep-cool-host.neon.tech/neondb',
        required: true,
      },
    ],
  },

  // --- 2. AI MODEL ENGINES (2-Way Synced with BYOK Keys) ---
  {
    id: 'gemini',
    name: 'Google Gemini Engine',
    provider: 'Google DeepMind',
    category: 'ai_models',
    description: 'Powers multimodal reasoning, Imagen 4, Veo 3.1 Cinema, Lyria Music, and Document OCR across all 5 studios.',
    shortTag: 'Primary Multimodal',
    studios: ['code', 'vision', 'cinema', 'music', 'document'],
    authType: 'api_key',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    capabilities: ['Chat & Code', 'Imagen 4 & Veo 3', 'Lyria & TTS'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Gemini API Key',
        type: 'secret',
        placeholder: 'AIzaSy...',
        required: true,
      },
    ],
  },
  {
    id: 'groq',
    name: 'Groq LPU Inference',
    provider: 'Groq Inc.',
    category: 'ai_models',
    description: 'Ultra-low latency Llama 3.3, Qwen & Mixtral inference fallback across Chat, Code, and Document Studios.',
    shortTag: 'Ultra-Fast LPU',
    studios: ['code', 'document'],
    authType: 'api_key',
    docsUrl: 'https://console.groq.com/docs',
    getKeyUrl: 'https://console.groq.com/keys',
    capabilities: ['Sub-second Streaming', 'Code Architecture', 'Document Drafting'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Groq API Key',
        type: 'secret',
        placeholder: 'gsk_...',
        required: true,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI Platform',
    provider: 'OpenAI',
    category: 'ai_models',
    description: 'Connect your OpenAI key for GPT-4o / o-series reasoning and OpenAI-compatible routing.',
    shortTag: 'GPT & Reasoning',
    studios: ['code', 'vision', 'document'],
    authType: 'api_key',
    docsUrl: 'https://platform.openai.com/docs',
    getKeyUrl: 'https://platform.openai.com/api-keys',
    capabilities: ['GPT Model Routing', 'Prompt Enhancement', 'Document Analysis'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'OpenAI Secret Key',
        type: 'secret',
        placeholder: 'sk-proj-...',
        required: true,
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'Anthropic',
    category: 'ai_models',
    description: 'Link Anthropic Claude keys for complex software engineering and long-horizon document audits.',
    shortTag: 'Claude Models',
    studios: ['code', 'document'],
    authType: 'api_key',
    docsUrl: 'https://docs.anthropic.com/',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    capabilities: ['Code Synthesis', 'Deep Document Audits', 'System Architecture'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Anthropic API Key',
        type: 'secret',
        placeholder: 'sk-ant-...',
        required: true,
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Reasoner',
    provider: 'DeepSeek AI',
    category: 'ai_models',
    description: 'Connect DeepSeek R1 / V3 reasoning models for algorithmic coding and mathematical verification.',
    shortTag: 'R1 Reasoning',
    studios: ['code', 'document'],
    authType: 'api_key',
    docsUrl: 'https://platform.deepseek.com/docs',
    getKeyUrl: 'https://platform.deepseek.com/api_keys',
    capabilities: ['Chain-of-Thought R1', 'Algorithm Synthesis', 'Low-Cost Inference'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'DeepSeek API Key',
        type: 'secret',
        placeholder: 'sk-...',
        required: true,
      },
    ],
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    provider: 'xAI',
    category: 'ai_models',
    description: 'Connect your xAI API key for Grok-class synthesis and creative ideation.',
    shortTag: 'Grok Engine',
    studios: ['code', 'document'],
    authType: 'api_key',
    docsUrl: 'https://docs.x.ai/',
    getKeyUrl: 'https://console.x.ai/',
    capabilities: ['Grok Models', 'Fast Creative Drafting', 'Real-time Synthesis'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'xAI API Key',
        type: 'secret',
        placeholder: 'xai-...',
        required: true,
      },
    ],
  },
  {
    id: 'cometapi',
    name: 'CometAPI Unified Gateway',
    provider: 'CometAPI',
    category: 'ai_models',
    description: 'Unified multi-model router supporting 500+ LLMs, video, image, and audio endpoints via one gateway.',
    shortTag: '500+ Models',
    studios: ['code', 'vision', 'cinema', 'music', 'document'],
    authType: 'api_key',
    docsUrl: 'https://api.cometapi.com/docs',
    getKeyUrl: 'https://api.cometapi.com/',
    capabilities: ['Unified LLM Proxy', 'Cross-Vendor Fallback', 'Usage Metering'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'apiKey',
        label: 'CometAPI Key',
        type: 'secret',
        placeholder: 'sk-...',
        required: true,
      },
      {
        key: 'baseUrl',
        label: 'Gateway Base URL',
        type: 'url',
        placeholder: 'https://api.cometapi.com/v1',
        required: false,
      },
    ],
  },
  {
    id: 'local_llm',
    name: 'Local Ollama / LM Studio',
    provider: 'Self-Hosted Local Runtime',
    category: 'ai_models',
    description: 'Bridge local GGUF / Ollama / LM Studio loopback servers for zero-egress private inference.',
    shortTag: 'Zero-Egress Local',
    studios: ['code', 'document'],
    authType: 'endpoint',
    docsUrl: 'https://ollama.com/library',
    capabilities: ['Localhost Loopback', 'GGUF Model Discovery', 'Offline Privacy'],
    supportsLiveTest: true,
    byokMapping: true,
    fields: [
      {
        key: 'baseUrl',
        label: 'Local Endpoint URL',
        type: 'url',
        placeholder: 'http://127.0.0.1:11434/v1',
        required: true,
      },
      {
        key: 'model',
        label: 'Default Model ID (Optional)',
        type: 'text',
        placeholder: 'llama3.2:latest',
        required: false,
      },
      {
        key: 'apiKey',
        label: 'Local Bearer Token (Optional)',
        type: 'secret',
        placeholder: 'Optional local token',
        required: false,
      },
    ],
  },

  // --- 3. VISION & DESIGN STUDIO ---
  {
    id: 'huggingface',
    name: 'Hugging Face Hub',
    provider: 'Hugging Face Inc.',
    category: 'vision',
    description: 'Verify your HF Hub access token for FLUX LoRAs, Stable Diffusion inference endpoints, and audio models.',
    shortTag: 'FLUX & LoRAs',
    studios: ['vision', 'cinema', 'music'],
    authType: 'api_key',
    docsUrl: 'https://huggingface.co/docs/hub/security-tokens',
    getKeyUrl: 'https://huggingface.co/settings/tokens',
    capabilities: ['Account Identity Verify', 'Open-Weight Inference', 'LoRA Assets'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'token',
        label: 'Hugging Face Access Token',
        type: 'secret',
        placeholder: 'hf_...',
        required: true,
      },
    ],
  },
  {
    id: 'replicate',
    name: 'Replicate / Fal.ai GPUs',
    provider: 'Replicate / Fal',
    category: 'vision',
    description: 'Link serverless GPU inference tokens for high-speed FLUX Pro, upscaling, and depth-map pipelines.',
    shortTag: 'Serverless GPU',
    studios: ['vision', 'cinema'],
    authType: 'api_key',
    docsUrl: 'https://replicate.com/docs/reference/http',
    getKeyUrl: 'https://replicate.com/account/api-tokens',
    capabilities: ['Account Quota Check', 'FLUX / SDXL Pipelines', '4x Upscalers'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiToken',
        label: 'Replicate API Token (r8_...)',
        type: 'secret',
        placeholder: 'r8_...',
        required: true,
      },
    ],
  },
  {
    id: 'figma',
    name: 'Figma Design System',
    provider: 'Figma Inc.',
    category: 'vision',
    description: 'Authenticate your Figma Personal Access Token to inspect design files, frames, and design tokens.',
    shortTag: 'Design Tokens',
    studios: ['vision', 'code'],
    authType: 'pat',
    docsUrl: 'https://www.figma.com/developers/api',
    getKeyUrl: 'https://www.figma.com/developers/api#access-tokens',
    capabilities: ['Profile & Team Access', 'Design Token Import', 'Frame Inspection'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'token',
        label: 'Figma Personal Access Token',
        type: 'secret',
        placeholder: 'figd_...',
        required: true,
      },
    ],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary Media CDN',
    provider: 'Cloudinary',
    category: 'vision',
    description: 'Connect your Cloudinary cloud workspace for CDN delivery, dynamic cropping, and asset archiving.',
    shortTag: 'Media CDN',
    studios: ['vision', 'cinema', 'document'],
    authType: 'api_key',
    docsUrl: 'https://cloudinary.com/documentation',
    getKeyUrl: 'https://console.cloudinary.com/',
    capabilities: ['Cloud CDN Ping', 'Auto-Format Transforms', 'Asset Hosting'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'cloudName',
        label: 'Cloud Name',
        type: 'text',
        placeholder: 'my-studio-cloud',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'text',
        placeholder: '123456789012345',
        required: true,
      },
      {
        key: 'apiSecret',
        label: 'API Secret',
        type: 'secret',
        placeholder: '••••••••••••',
        required: true,
      },
    ],
  },

  // --- 4. CINEMA & VIDEO STUDIO ---
  {
    id: 'runway_luma',
    name: 'Runway / Luma Video Gateway',
    provider: 'Runway / Luma Labs',
    category: 'cinema',
    description: 'Store API credentials for external Gen-4 / Dream Machine cinema model routing alongside Veo 3.1.',
    shortTag: 'External Video AI',
    studios: ['cinema'],
    authType: 'api_key',
    docsUrl: 'https://docs.dev.runwayml.com/',
    capabilities: ['Encrypted Key Vault', 'Multi-Vendor Cinema', 'Custom Endpoint'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'providerUrl',
        label: 'Gateway Base URL',
        type: 'url',
        placeholder: 'https://api.dev.runwayml.com/v1',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Secret Key',
        type: 'secret',
        placeholder: 'key_...',
        required: true,
      },
    ],
  },
  {
    id: 'mux',
    name: 'Mux Video Streaming',
    provider: 'Mux Inc.',
    category: 'cinema',
    description: 'Connect Mux Token ID & Secret to verify streaming asset APIs and adaptive HLS video delivery.',
    shortTag: 'HLS Streaming',
    studios: ['cinema', 'code'],
    authType: 'api_key',
    docsUrl: 'https://docs.mux.com/api-reference',
    getKeyUrl: 'https://dashboard.mux.com/settings/access-tokens',
    capabilities: ['HLS Video Delivery', 'Thumbnail Extraction', 'Live Token Verify'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'tokenId',
        label: 'Mux Token ID',
        type: 'text',
        placeholder: 'a1b2c3d4-...',
        required: true,
      },
      {
        key: 'tokenSecret',
        label: 'Mux Token Secret',
        type: 'secret',
        placeholder: 'mux_secret_...',
        required: true,
      },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube Data API',
    provider: 'Google YouTube',
    category: 'cinema',
    description: 'Verify a YouTube Data v3 API key or OAuth token for channel analytics and cinema publishing workflows.',
    shortTag: 'Video Publishing',
    studios: ['cinema', 'music'],
    authType: 'api_key',
    docsUrl: 'https://developers.google.com/youtube/v3',
    getKeyUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    capabilities: ['Channel & Quota Probe', 'Metadata Validation', 'Creator Bridge'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiKey',
        label: 'YouTube Data v3 API Key',
        type: 'secret',
        placeholder: 'AIzaSy...',
        required: true,
      },
    ],
  },

  // --- 5. MUSIC & AUDIO STUDIO ---
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Voice & SFX',
    provider: 'ElevenLabs Inc.',
    category: 'music',
    description: 'Verify live ElevenLabs character quota, neural voice cloning profiles, and high-definition sound effects.',
    shortTag: 'Voice & SFX',
    studios: ['music', 'cinema', 'document'],
    authType: 'api_key',
    docsUrl: 'https://elevenlabs.io/docs/api-reference',
    getKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    capabilities: ['Live Subscription Quota', 'Voice Cloning Bridge', 'SFX Generation'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiKey',
        label: 'ElevenLabs xi-api-key',
        type: 'secret',
        placeholder: 'sk_...',
        required: true,
      },
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify Web API',
    provider: 'Spotify AB',
    category: 'music',
    description: 'Link Spotify Client credentials for audio feature analysis, BPM/key lookup, and reference track matching.',
    shortTag: 'Audio Metadata',
    studios: ['music'],
    authType: 'oauth_token',
    docsUrl: 'https://developer.spotify.com/documentation/web-api',
    getKeyUrl: 'https://developer.spotify.com/dashboard',
    capabilities: ['OAuth Client Token Test', 'BPM & Key Lookup', 'Genre Analysis'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'clientId',
        label: 'Spotify Client ID',
        type: 'text',
        placeholder: '32-char Client ID',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Spotify Client Secret',
        type: 'secret',
        placeholder: '32-char Client Secret',
        required: true,
      },
    ],
  },
  {
    id: 'freesound',
    name: 'Freesound SFX Library',
    provider: 'Freesound.org',
    category: 'music',
    description: 'Connect Freesound API v2 for Creative Commons foley, ambient stems, and percussion samples.',
    shortTag: 'Foley Samples',
    studios: ['music', 'cinema'],
    authType: 'api_key',
    docsUrl: 'https://freesound.org/docs/api/',
    getKeyUrl: 'https://freesound.org/apiv2/apply',
    capabilities: ['Live Search Verify', 'CC0 Sample Queries', 'Foley Discovery'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Freesound API Key',
        type: 'secret',
        placeholder: 'freesound_api_key...',
        required: true,
      },
    ],
  },

  // --- 6. DOCUMENT, SEARCH & COMMS STUDIO ---
  {
    id: 'notion',
    name: 'Notion Workspace',
    provider: 'Notion Labs',
    category: 'document',
    description: 'Connect a Notion internal integration token to sync executive reports, notes, and knowledge bases.',
    shortTag: 'Knowledge Sync',
    studios: ['document', 'code'],
    authType: 'api_key',
    docsUrl: 'https://developers.notion.com/',
    getKeyUrl: 'https://www.notion.so/my-integrations',
    capabilities: ['Live Bot Identity Check', 'Workspace Page Sync', 'Report Export'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'token',
        label: 'Internal Integration Secret',
        type: 'secret',
        placeholder: 'ntn_... or secret_...',
        required: true,
      },
      {
        key: 'databaseId',
        label: 'Default Database ID (Optional)',
        type: 'text',
        placeholder: '32-char database UUID',
        required: false,
      },
    ],
  },
  {
    id: 'google_workspace',
    name: 'Google Workspace (Drive / Docs)',
    provider: 'Google Workspace',
    category: 'document',
    description: 'Verify a Google Workspace OAuth access token to bridge Drive folders, Google Docs, and Sheets.',
    shortTag: 'Drive & Docs',
    studios: ['document'],
    authType: 'oauth_token',
    docsUrl: 'https://developers.google.com/drive/api/v3/about-sdk',
    getKeyUrl: 'https://console.cloud.google.com/apis/credentials',
    capabilities: ['Drive Quota Verification', 'Docs Import/Export', 'Sheets Sync'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'accessToken',
        label: 'OAuth 2.0 Access Token',
        type: 'secret',
        placeholder: 'ya29.a0...',
        required: true,
      },
    ],
  },
  {
    id: 'tavily',
    name: 'Tavily Web Research',
    provider: 'Tavily AI',
    category: 'document',
    description: 'Real-time citation web search engine optimized for Document Studio Graph-RAG and executive memos.',
    shortTag: 'Live Citations',
    studios: ['document', 'code'],
    authType: 'api_key',
    docsUrl: 'https://docs.tavily.com/',
    getKeyUrl: 'https://app.tavily.com/home',
    capabilities: ['Live Search Probe', 'Citation Grounding', 'RAG Context'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Tavily API Key',
        type: 'secret',
        placeholder: 'tvly-...',
        required: true,
      },
    ],
  },
  {
    id: 'resend',
    name: 'Resend Transactional Email',
    provider: 'Resend Inc.',
    category: 'document',
    description: 'Verify verified sending domains and dispatch generated briefs or app alerts via modern email APIs.',
    shortTag: 'Email Dispatch',
    studios: ['document', 'code'],
    authType: 'api_key',
    docsUrl: 'https://resend.com/docs',
    getKeyUrl: 'https://resend.com/api-keys',
    capabilities: ['Verified Domain Check', 'Report Delivery', 'SaaS Mailer'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'apiKey',
        label: 'Resend API Key',
        type: 'secret',
        placeholder: 're_...',
        required: true,
      },
      {
        key: 'fromEmail',
        label: 'Default Sender Email (Optional)',
        type: 'text',
        placeholder: 'studio@yourdomain.com',
        required: false,
      },
    ],
  },
  {
    id: 'slack_discord',
    name: 'Slack & Discord Webhooks',
    provider: 'Slack / Discord',
    category: 'document',
    description: 'Receive live notifications when builds, renders, audio masters, or documents complete across all studios.',
    shortTag: 'Team Webhooks',
    studios: ['code', 'vision', 'cinema', 'music', 'document'],
    authType: 'webhook',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    capabilities: ['SSRF-Safe Webhook Dispatch', 'Discord Metadata Inspect', 'Cross-Studio Alerts'],
    supportsLiveTest: true,
    fields: [
      {
        key: 'webhookUrl',
        label: 'Incoming Webhook URL (HTTPS)',
        type: 'secret',
        placeholder: 'https://discord.com/api/webhooks/... or https://hooks.slack.com/services/...',
        required: true,
      },
      {
        key: 'channelLabel',
        label: 'Channel Label (Optional)',
        type: 'text',
        placeholder: '#raone-studio-renders',
        required: false,
      },
    ],
  },
];

// =========================================================================
// Vault Storage Types
// =========================================================================
interface StoredPluginVaultRecord {
  id: string;
  enabled: boolean;
  bookmarked: boolean;
  encryptedSecrets: Record<string, string>;
  publicFields: Record<string, string>;
  enabledStudios: PluginStudioScope[];
  connectedAt?: string | null;
  updatedAt?: string | null;
  lastTestedAt?: string | null;
  lastTestOk?: boolean | null;
  lastTestLatencyMs?: number | null;
  lastTestMessage?: string | null;
  verifiedAccount?: string | null;
}

type PluginVaultMap = Record<string, StoredPluginVaultRecord>;

// =========================================================================
// SSRF-Hardened Plugin Egress Validator
// =========================================================================
function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '');
  if (net.isIPv4(normalized)) {
    const octets = normalized.split('.').map(Number);
    if (octets.length !== 4) return true;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Cloud metadata & link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    );
  }
  return true;
}

export async function validatePluginOutboundUrl(
  rawUrl: string
): Promise<{ ok: true; parsedUrl: URL } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: 'Invalid HTTPS URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTPS endpoints are permitted for plugin connections.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Embedded credentials in URLs are not permitted.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    net.isIP(host) !== 0
  ) {
    return {
      ok: false,
      reason: 'Localhost, direct IP literals, and internal hostnames are blocked for security.',
    };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: `DNS lookup returned no records for ${host}.` };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return {
          ok: false,
          reason: `Resolved IP (${rec.address}) belongs to a private or reserved network.`,
        };
      }
    }
  } catch {
    return { ok: false, reason: `DNS resolution failed for ${host}.` };
  }

  return { ok: true, parsedUrl: parsed };
}

// =========================================================================
// Secret Masking & BYOK Mapping Helpers
// =========================================================================
export function maskSecretValue(secret: string): string {
  const trimmed = (secret || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 6) return '••••••';
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}

const BYOK_SECRET_BRIDGE: Record<
  string,
  { secretField: keyof ByokKeyMap; urlField?: keyof ByokKeyMap; modelField?: keyof ByokKeyMap }
> = {
  gemini: { secretField: 'geminiApiKey' },
  groq: { secretField: 'groqApiKey' },
  openai: { secretField: 'openAiApiKey' },
  anthropic: { secretField: 'anthropicApiKey' },
  deepseek: { secretField: 'deepSeekApiKey' },
  xai: { secretField: 'xaiApiKey' },
  cometapi: { secretField: 'cometApiKey', urlField: 'cometApiBaseUrl' },
  local_llm: {
    secretField: 'localLlmApiKey',
    urlField: 'localLlmBaseUrl',
    modelField: 'localLlmModel',
  },
};

function customDefToCatalogEntry(def: CustomPluginDefinition): PluginCatalogEntry {
  return {
    id: def.id,
    name: def.name,
    provider: def.provider || 'Custom REST / MCP',
    category: 'custom',
    description: def.description || `Custom connector pointing to ${def.baseUrl}`,
    shortTag: 'Custom REST',
    studios: def.studios?.length ? def.studios : ['code', 'document'],
    authType: def.authScheme === 'None' ? 'endpoint' : 'api_key',
    docsUrl: def.baseUrl,
    capabilities: def.capabilities?.length ? def.capabilities : ['Live Health Probe', 'Encrypted Secret'],
    supportsLiveTest: true,
    fields:
      def.authScheme === 'None'
        ? [
            {
              key: 'baseUrlOverride',
              label: 'Endpoint URL Override (Optional)',
              type: 'url',
              placeholder: def.baseUrl,
              required: false,
            },
          ]
        : [
            {
              key: 'apiKey',
              label: `${def.authHeaderName || 'Authorization'} Token`,
              type: 'secret',
              placeholder: 'Paste your custom endpoint token...',
              required: true,
            },
            {
              key: 'baseUrlOverride',
              label: 'Endpoint URL Override (Optional)',
              type: 'url',
              placeholder: def.baseUrl,
              required: false,
            },
          ],
  };
}

// =========================================================================
// Read Catalog + Tenant Vault (Never Returns Plaintext Secrets!)
// =========================================================================
export async function listTenantPlugins(tenantId: string): Promise<{
  plugins: PluginPublicView[];
  stats: PluginLibraryStats;
}> {
  const [vault, customDefs, byok] = await Promise.all([
    readTenantCollection<PluginVaultMap>(tenantId, 'plugins_vault', {}),
    readTenantCollection<CustomPluginDefinition[]>(tenantId, 'custom_plugins', []),
    getTenantByokKeys(tenantId),
  ]);

  const allEntries: Array<{ entry: PluginCatalogEntry; customDef?: CustomPluginDefinition }> = [
    ...PLUGIN_CATALOG.map((entry) => ({ entry })),
    ...customDefs.map((customDef) => ({ entry: customDefToCatalogEntry(customDef), customDef })),
  ];

  const plugins: PluginPublicView[] = allEntries.map(({ entry, customDef }) => {
    const rec = vault[entry.id];
    const maskedFields: Record<string, string> = {};
    const publicFields: Record<string, string> = {};

    let hasStoredSecret = false;
    if (rec?.encryptedSecrets) {
      for (const [k, enc] of Object.entries(rec.encryptedSecrets)) {
        const plain = enc ? decryptSecret(enc) : '';
        if (plain) {
          maskedFields[k] = maskSecretValue(plain);
          hasStoredSecret = true;
        }
      }
    }
    if (rec?.publicFields) {
      for (const [k, val] of Object.entries(rec.publicFields)) {
        if (val) {
          publicFields[k] = val;
        }
      }
    }

    // 2-way read sync from BYOK AI keys if vault entry doesn't already hold them
    let source: PluginPublicView['source'] =
      hasStoredSecret || Object.keys(publicFields).length > 0 ? 'vault' : 'none';

    const byokSpec = BYOK_SECRET_BRIDGE[entry.id];
    if (byokSpec) {
      const byokSecret = (byok[byokSpec.secretField] as string | undefined) || '';
      const byokUrl = byokSpec.urlField ? (byok[byokSpec.urlField] as string | undefined) || '' : '';
      const byokModel = byokSpec.modelField ? (byok[byokSpec.modelField] as string | undefined) || '' : '';

      if (byokSecret && !maskedFields.apiKey) {
        maskedFields.apiKey = maskSecretValue(byokSecret);
        source = source === 'vault' ? 'vault' : 'byok';
      }
      if (byokUrl && !publicFields.baseUrl) {
        publicFields.baseUrl = byokUrl;
        if (source === 'none') source = 'byok';
      }
      if (byokModel && !publicFields.model) {
        publicFields.model = byokModel;
      }
    }

    // Check required fields satisfied
    const requiredFields = entry.fields.filter((f) => f.required);
    const hasAllRequired =
      requiredFields.length > 0
        ? requiredFields.every((f) =>
            f.type === 'secret' ? Boolean(maskedFields[f.key]) : Boolean(publicFields[f.key])
          )
        : Object.keys(maskedFields).length > 0 || Object.keys(publicFields).length > 0;

    // For custom plugin with authScheme === 'None', its baseUrl in customDef already satisfies connection
    const isConnected = customDef && customDef.authScheme === 'None'
      ? rec ? Boolean(rec.connectedAt || Object.keys(publicFields).length > 0) : true
      : hasAllRequired;

    const enabled = isConnected ? (rec ? rec.enabled !== false : true) : false;
    const enabledStudios =
      rec?.enabledStudios && rec.enabledStudios.length > 0
        ? rec.enabledStudios.filter((s) => entry.studios.includes(s))
        : [...entry.studios];

    return {
      ...entry,
      isConnected,
      enabled,
      bookmarked: Boolean(rec?.bookmarked),
      enabledStudios: enabledStudios.length > 0 ? enabledStudios : [...entry.studios],
      maskedFields,
      publicFields,
      source: isConnected ? source : 'none',
      connectedAt: rec?.connectedAt || (isConnected && source === 'byok' ? new Date().toISOString() : null),
      updatedAt: rec?.updatedAt || null,
      lastTestedAt: rec?.lastTestedAt || null,
      lastTestOk: rec?.lastTestOk ?? null,
      lastTestLatencyMs: rec?.lastTestLatencyMs ?? null,
      lastTestMessage: rec?.lastTestMessage ?? null,
      verifiedAccount: rec?.verifiedAccount ?? null,
      isCustom: Boolean(customDef),
      customDef,
    };
  });

  const byCategory: Record<PluginCategory, number> = {
    code: 0,
    ai_models: 0,
    vision: 0,
    cinema: 0,
    music: 0,
    document: 0,
    custom: 0,
  };
  const byStudio: Record<PluginStudioScope, { total: number; connected: number }> = {
    code: { total: 0, connected: 0 },
    vision: { total: 0, connected: 0 },
    cinema: { total: 0, connected: 0 },
    music: { total: 0, connected: 0 },
    document: { total: 0, connected: 0 },
  };

  for (const p of plugins) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    for (const s of p.studios) {
      byStudio[s].total += 1;
      if (p.isConnected && p.enabled && p.enabledStudios.includes(s)) {
        byStudio[s].connected += 1;
      }
    }
  }

  const stats: PluginLibraryStats = {
    total: plugins.length,
    connected: plugins.filter((p) => p.isConnected).length,
    enabled: plugins.filter((p) => p.isConnected && p.enabled).length,
    bookmarked: plugins.filter((p) => p.bookmarked).length,
    customCount: customDefs.length,
    byCategory,
    byStudio,
  };

  return { plugins, stats };
}

async function resolvePluginEntry(tenantId: string, pluginId: string): Promise<{
  entry: PluginCatalogEntry;
  customDef?: CustomPluginDefinition;
} | null> {
  const builtIn = PLUGIN_CATALOG.find((p) => p.id === pluginId);
  if (builtIn) return { entry: builtIn };
  const customDefs = await readTenantCollection<CustomPluginDefinition[]>(tenantId, 'custom_plugins', []);
  const customDef = customDefs.find((c) => c.id === pluginId);
  if (customDef) return { entry: customDefToCatalogEntry(customDef), customDef };
  return null;
}

export async function getDecryptedPluginFields(
  tenantId: string,
  pluginId: string
): Promise<Record<string, string>> {
  const [vault, byok] = await Promise.all([
    readTenantCollection<PluginVaultMap>(tenantId, 'plugins_vault', {}),
    getTenantByokKeys(tenantId),
  ]);
  const rec = vault[pluginId];
  const result: Record<string, string> = {};

  if (rec?.publicFields) {
    for (const [k, v] of Object.entries(rec.publicFields)) {
      if (v) result[k] = v;
    }
  }
  if (rec?.encryptedSecrets) {
    for (const [k, enc] of Object.entries(rec.encryptedSecrets)) {
      const dec = enc ? decryptSecret(enc) : '';
      if (dec) result[k] = dec;
    }
  }

  const byokSpec = BYOK_SECRET_BRIDGE[pluginId];
  if (byokSpec) {
    const s = (byok[byokSpec.secretField] as string | undefined) || '';
    if (s && !result.apiKey) result.apiKey = s;
    if (byokSpec.urlField) {
      const u = (byok[byokSpec.urlField] as string | undefined) || '';
      if (u && !result.baseUrl) result.baseUrl = u;
    }
    if (byokSpec.modelField) {
      const m = (byok[byokSpec.modelField] as string | undefined) || '';
      if (m && !result.model) result.model = m;
    }
  }

  return result;
}

// =========================================================================
// Connect / Update / Toggle / Bookmark / Disconnect Operations
// =========================================================================
export async function connectTenantPlugin(opts: {
  tenantId: string;
  pluginId: string;
  fields: Record<string, string>;
  enabledStudios?: PluginStudioScope[];
  enabled?: boolean;
}): Promise<PluginPublicView> {
  const resolved = await resolvePluginEntry(opts.tenantId, opts.pluginId);
  if (!resolved) {
    throw new Error(`Unknown plugin "${opts.pluginId}".`);
  }
  const { entry } = resolved;

  // Validate URL fields for SSRF safety before storing
  for (const fieldDef of entry.fields) {
    const rawVal = String(opts.fields?.[fieldDef.key] ?? '').trim();
    if (!rawVal) continue;
    if (fieldDef.type === 'url') {
      if (entry.id === 'local_llm') {
        const localCheck = await validateLocalLlmEndpoint(rawVal);
        if (!localCheck.ok) {
          throw new Error(localCheck.reason || 'Invalid local LLM endpoint URL.');
        }
      } else {
        const check = await validatePluginOutboundUrl(rawVal);
        if (!check.ok) {
          throw new Error(check.reason || `Blocked unsafe URL for ${fieldDef.label}.`);
        }
      }
    }
    if (fieldDef.key === 'webhookUrl') {
      const check = await validatePluginOutboundUrl(rawVal);
      if (!check.ok) {
        throw new Error(check.reason || 'Webhook URL failed HTTPS/SSRF validation.');
      }
    }
  }

  const existingDecrypted = await getDecryptedPluginFields(opts.tenantId, opts.pluginId);

  // Merge with existing if secret field left empty (allows editing studios or non-secret fields)
  const mergedFields: Record<string, string> = { ...existingDecrypted };
  for (const fieldDef of entry.fields) {
    if (opts.fields && fieldDef.key in opts.fields) {
      const incoming = String(opts.fields[fieldDef.key] ?? '').trim();
      if (fieldDef.type === 'secret') {
        // Only overwrite secret if non-empty and not a masked echo placeholder
        if (incoming && !incoming.includes('••••')) {
          mergedFields[fieldDef.key] = incoming;
        }
      } else {
        if (incoming) {
          mergedFields[fieldDef.key] = incoming;
        } else {
          delete mergedFields[fieldDef.key];
        }
      }
    }
  }

  // Ensure all required fields are present after merge
  for (const fieldDef of entry.fields) {
    if (fieldDef.required && !mergedFields[fieldDef.key]?.trim()) {
      throw new Error(`Field "${fieldDef.label}" is required to connect ${entry.name}.`);
    }
  }

  const encryptedSecrets: Record<string, string> = {};
  const publicFields: Record<string, string> = {};
  for (const fieldDef of entry.fields) {
    const val = mergedFields[fieldDef.key]?.trim();
    if (!val) continue;
    if (fieldDef.type === 'secret') {
      encryptedSecrets[fieldDef.key] = encryptSecret(val);
    } else {
      publicFields[fieldDef.key] = val;
    }
  }

  const validStudios =
    opts.enabledStudios && opts.enabledStudios.length > 0
      ? opts.enabledStudios.filter((s) => entry.studios.includes(s))
      : [...entry.studios];

  const now = new Date().toISOString();
  await mutateTenantCollection<PluginVaultMap>(opts.tenantId, 'plugins_vault', {}, (current) => {
    const prev = current[entry.id];
    return {
      ...current,
      [entry.id]: {
        id: entry.id,
        enabled: opts.enabled !== undefined ? Boolean(opts.enabled) : true,
        bookmarked: prev?.bookmarked || false,
        encryptedSecrets,
        publicFields,
        enabledStudios: validStudios.length > 0 ? validStudios : [...entry.studios],
        connectedAt: prev?.connectedAt || now,
        updatedAt: now,
        lastTestedAt: prev?.lastTestedAt || null,
        lastTestOk: prev?.lastTestOk ?? null,
        lastTestLatencyMs: prev?.lastTestLatencyMs ?? null,
        lastTestMessage: prev?.lastTestMessage ?? null,
        verifiedAccount: prev?.verifiedAccount ?? null,
      },
    };
  });

  // 2-way sync AI models back to tenant BYOK key vault
  const byokSpec = BYOK_SECRET_BRIDGE[entry.id];
  if (byokSpec) {
    const updates: ByokKeyMap = {};
    if (mergedFields.apiKey) updates[byokSpec.secretField] = mergedFields.apiKey;
    if (byokSpec.urlField && mergedFields.baseUrl !== undefined) {
      updates[byokSpec.urlField] = mergedFields.baseUrl || '';
    }
    if (byokSpec.modelField && mergedFields.model !== undefined) {
      updates[byokSpec.modelField] = mergedFields.model || '';
    }
    if (Object.keys(updates).length > 0) {
      await saveTenantByokKeys(opts.tenantId, updates);
    }
  }

  const { plugins } = await listTenantPlugins(opts.tenantId);
  const updated = plugins.find((p) => p.id === entry.id);
  if (!updated) throw new Error('Failed to load updated plugin state.');
  return updated;
}

export async function toggleTenantPlugin(opts: {
  tenantId: string;
  pluginId: string;
  enabled?: boolean;
  enabledStudios?: PluginStudioScope[];
}): Promise<PluginPublicView> {
  const resolved = await resolvePluginEntry(opts.tenantId, opts.pluginId);
  if (!resolved) throw new Error(`Unknown plugin "${opts.pluginId}".`);

  await mutateTenantCollection<PluginVaultMap>(opts.tenantId, 'plugins_vault', {}, (current) => {
    const prev = current[opts.pluginId] || {
      id: opts.pluginId,
      enabled: true,
      bookmarked: false,
      encryptedSecrets: {},
      publicFields: {},
      enabledStudios: [...resolved.entry.studios],
    };
    const nextStudios =
      opts.enabledStudios && opts.enabledStudios.length > 0
        ? opts.enabledStudios.filter((s) => resolved.entry.studios.includes(s))
        : prev.enabledStudios;
    return {
      ...current,
      [opts.pluginId]: {
        ...prev,
        enabled: opts.enabled !== undefined ? Boolean(opts.enabled) : !prev.enabled,
        enabledStudios: nextStudios.length > 0 ? nextStudios : [...resolved.entry.studios],
        updatedAt: new Date().toISOString(),
      },
    };
  });

  const { plugins } = await listTenantPlugins(opts.tenantId);
  const updated = plugins.find((p) => p.id === opts.pluginId);
  if (!updated) throw new Error('Failed to reload toggled plugin.');
  return updated;
}

export async function toggleBookmarkPlugin(
  tenantId: string,
  pluginId: string,
  bookmarked?: boolean
): Promise<PluginPublicView> {
  const resolved = await resolvePluginEntry(tenantId, pluginId);
  if (!resolved) throw new Error(`Unknown plugin "${pluginId}".`);

  await mutateTenantCollection<PluginVaultMap>(tenantId, 'plugins_vault', {}, (current) => {
    const prev = current[pluginId] || {
      id: pluginId,
      enabled: false,
      bookmarked: false,
      encryptedSecrets: {},
      publicFields: {},
      enabledStudios: [...resolved.entry.studios],
    };
    return {
      ...current,
      [pluginId]: {
        ...prev,
        bookmarked: bookmarked !== undefined ? Boolean(bookmarked) : !prev.bookmarked,
        updatedAt: new Date().toISOString(),
      },
    };
  });

  const { plugins } = await listTenantPlugins(tenantId);
  const updated = plugins.find((p) => p.id === pluginId);
  if (!updated) throw new Error('Failed to update bookmark state.');
  return updated;
}

export async function disconnectTenantPlugin(
  tenantId: string,
  pluginId: string
): Promise<PluginPublicView> {
  const resolved = await resolvePluginEntry(tenantId, pluginId);
  if (!resolved) throw new Error(`Unknown plugin "${pluginId}".`);

  await mutateTenantCollection<PluginVaultMap>(tenantId, 'plugins_vault', {}, (current) => {
    const prev = current[pluginId];
    if (!prev) return current;
    const next = { ...current };
    // Keep bookmark if set, wipe all encrypted secrets & connection timestamps cleanly
    if (prev.bookmarked) {
      next[pluginId] = {
        id: pluginId,
        enabled: false,
        bookmarked: true,
        encryptedSecrets: {},
        publicFields: {},
        enabledStudios: [...resolved.entry.studios],
        updatedAt: new Date().toISOString(),
      };
    } else {
      delete next[pluginId];
    }
    return next;
  });

  // 2-way clear from BYOK keys if AI model plugin
  const byokSpec = BYOK_SECRET_BRIDGE[pluginId];
  if (byokSpec) {
    const clearUpdates: ByokKeyMap = {
      [byokSpec.secretField]: '',
      ...(byokSpec.urlField ? { [byokSpec.urlField]: '' } : {}),
      ...(byokSpec.modelField ? { [byokSpec.modelField]: '' } : {}),
    };
    await saveTenantByokKeys(tenantId, clearUpdates);
  }

  const { plugins } = await listTenantPlugins(tenantId);
  const updated = plugins.find((p) => p.id === pluginId);
  if (!updated) throw new Error('Failed to reload disconnected plugin.');
  return updated;
}

// =========================================================================
// Custom REST / MCP Plugin Builder CRUD
// =========================================================================
export async function saveCustomPluginDefinition(opts: {
  tenantId: string;
  id?: string;
  name: string;
  provider?: string;
  baseUrl: string;
  healthPath?: string;
  authHeaderName?: string;
  authScheme?: CustomPluginDefinition['authScheme'];
  description?: string;
  studios?: PluginStudioScope[];
  capabilities?: string[];
  apiKey?: string;
}): Promise<PluginPublicView> {
  const name = String(opts.name || '').trim();
  const baseUrl = String(opts.baseUrl || '').trim().replace(/\/+$/, '');
  if (!name || !baseUrl) {
    throw new Error('Plugin name and HTTPS Base URL are required.');
  }

  const urlCheck = await validatePluginOutboundUrl(baseUrl);
  if (!urlCheck.ok) {
    throw new Error(urlCheck.reason || 'Custom plugin Base URL failed HTTPS/SSRF check.');
  }

  const cleanId =
    opts.id && opts.id.startsWith('custom_')
      ? opts.id
      : `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28)}_${crypto.randomUUID().slice(0, 6)}`;

  const healthPathCheck = validatePluginHealthPath(opts.healthPath || '/');
  if (!healthPathCheck.ok) {
    throw new Error(healthPathCheck.reason);
  }
  const authHeaderCheck = validatePluginHeaderName(opts.authHeaderName || 'Authorization');
  if (!authHeaderCheck.ok) {
    throw new Error(authHeaderCheck.reason);
  }

  const now = new Date().toISOString();
  const newDef: CustomPluginDefinition = {
    id: cleanId,
    name,
    provider: String(opts.provider || 'Custom REST / MCP').trim(),
    baseUrl,
    healthPath: healthPathCheck.value,
    authHeaderName: authHeaderCheck.value,
    authScheme: opts.authScheme || 'Bearer',
    description: String(opts.description || `Custom API bridge to ${urlCheck.parsedUrl.hostname}`).trim(),
    studios:
      opts.studios && opts.studios.length > 0
        ? opts.studios
        : ['code', 'document'],
    capabilities:
      opts.capabilities && opts.capabilities.length > 0
        ? opts.capabilities
        : ['REST Bridge', 'Encrypted Key', 'Live Probe'],
    createdAt: now,
    updatedAt: now,
  };

  await mutateTenantCollection<CustomPluginDefinition[]>(opts.tenantId, 'custom_plugins', [], (list) => {
    const idx = list.findIndex((item) => item.id === cleanId);
    if (idx >= 0) {
      const updated = [...list];
      updated[idx] = { ...list[idx], ...newDef, createdAt: list[idx].createdAt };
      return updated;
    }
    return [newDef, ...list];
  });

  if (opts.apiKey && opts.apiKey.trim()) {
    return connectTenantPlugin({
      tenantId: opts.tenantId,
      pluginId: cleanId,
      fields: { apiKey: opts.apiKey.trim() },
      enabledStudios: newDef.studios,
      enabled: true,
    });
  }

  if (newDef.authScheme === 'None') {
    await mutateTenantCollection<PluginVaultMap>(opts.tenantId, 'plugins_vault', {}, (current) => ({
      ...current,
      [cleanId]: {
        id: cleanId,
        enabled: true,
        bookmarked: current[cleanId]?.bookmarked || false,
        encryptedSecrets: current[cleanId]?.encryptedSecrets || {},
        publicFields: current[cleanId]?.publicFields || {},
        enabledStudios: newDef.studios,
        connectedAt: current[cleanId]?.connectedAt || now,
        updatedAt: now,
      },
    }));
  }

  const { plugins } = await listTenantPlugins(opts.tenantId);
  const created = plugins.find((p) => p.id === cleanId);
  if (!created) throw new Error('Failed to load created custom plugin.');
  return created;
}

export async function deleteCustomPluginDefinition(
  tenantId: string,
  pluginId: string
): Promise<boolean> {
  if (!pluginId.startsWith('custom_')) {
    throw new Error('Only custom plugins can be deleted from the catalog.');
  }
  let removed = false;
  await mutateTenantCollection<CustomPluginDefinition[]>(tenantId, 'custom_plugins', [], (list) => {
    const filtered = list.filter((c) => c.id !== pluginId);
    removed = filtered.length !== list.length;
    return filtered;
  });
  await mutateTenantCollection<PluginVaultMap>(tenantId, 'plugins_vault', {}, (current) => {
    if (!current[pluginId]) return current;
    const next = { ...current };
    delete next[pluginId];
    return next;
  });
  return removed;
}

// =========================================================================
// Live Vendor API Connection Tester (Real HTTP / Latency / Identity Check)
// =========================================================================
async function timedFetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<{ status: number; ok: boolean; latencyMs: number; json: any; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { ...init, redirect: 'error', signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, latencyMs, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function testPluginConnectionServer(opts: {
  tenantId: string;
  pluginId: string;
  candidateFields?: Record<string, string>;
}): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
  verifiedAccount?: string | null;
  testedAt: string;
}> {
  const resolved = await resolvePluginEntry(opts.tenantId, opts.pluginId);
  if (!resolved) throw new Error(`Unknown plugin "${opts.pluginId}".`);

  const stored = await getDecryptedPluginFields(opts.tenantId, opts.pluginId);
  const fields: Record<string, string> = { ...stored };
  if (opts.candidateFields) {
    for (const [k, v] of Object.entries(opts.candidateFields)) {
      const trimmed = String(v ?? '').trim();
      if (trimmed && !trimmed.includes('••••')) {
        fields[k] = trimmed;
      }
    }
  }

  const testedAt = new Date().toISOString();
  const startedAt = Date.now();
  let ok = false;
  let latencyMs = 0;
  let message = '';
  let verifiedAccount: string | null = null;

  try {
    switch (opts.pluginId) {
      case 'github': {
        const token = fields.token || '';
        if (!token) throw new Error('GitHub Personal Access Token is required.');
        const r = await timedFetchJson('https://api.github.com/user', {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'RaOne-AI-Studio',
          },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.login) {
          ok = true;
          verifiedAccount = `@${r.json.login}`;
          message = `Authenticated as GitHub user @${r.json.login} (${r.json.public_repos ?? 0} public repos).`;
        } else {
          message = r.json?.message || `GitHub HTTP ${r.status} verification failed.`;
        }
        break;
      }

      case 'vercel': {
        const token = fields.token || '';
        if (!token) throw new Error('Vercel Access Token is required.');
        const r = await timedFetchJson('https://api.vercel.com/v2/user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.user) {
          ok = true;
          verifiedAccount = r.json.user.username || r.json.user.email || 'Vercel User';
          message = `Verified Vercel account (${verifiedAccount}).`;
        } else {
          message = r.json?.error?.message || `Vercel HTTP ${r.status} rejected token.`;
        }
        break;
      }

      case 'huggingface': {
        const token = fields.token || '';
        if (!token) throw new Error('Hugging Face token is required.');
        const r = await timedFetchJson('https://huggingface.co/api/whoami-v2', {
          headers: { Authorization: `Bearer ${token}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.name) {
          ok = true;
          verifiedAccount = r.json.name;
          message = `Authenticated Hugging Face account "${r.json.name}" (${r.json.type || 'user'}).`;
        } else {
          message = r.json?.error || `Hugging Face HTTP ${r.status} rejected token.`;
        }
        break;
      }

      case 'replicate': {
        const token = fields.apiToken || '';
        if (!token) throw new Error('Replicate API token is required.');
        const r = await timedFetchJson('https://api.replicate.com/v1/account', {
          headers: { Authorization: `Bearer ${token}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.username) {
          ok = true;
          verifiedAccount = `@${r.json.username}`;
          message = `Verified Replicate workspace @${r.json.username} (${r.json.type || 'user'}).`;
        } else {
          message = r.json?.detail || `Replicate HTTP ${r.status} rejected token.`;
        }
        break;
      }

      case 'figma': {
        const token = fields.token || '';
        if (!token) throw new Error('Figma PAT is required.');
        const r = await timedFetchJson('https://api.figma.com/v1/me', {
          headers: { 'X-Figma-Token': token },
        });
        latencyMs = r.latencyMs;
        if (r.ok && (r.json?.handle || r.json?.email)) {
          ok = true;
          verifiedAccount = r.json.handle || r.json.email;
          message = `Verified Figma designer profile (${verifiedAccount}).`;
        } else {
          message = r.json?.err || r.json?.message || `Figma HTTP ${r.status} verification failed.`;
        }
        break;
      }

      case 'notion': {
        const token = fields.token || '';
        if (!token) throw new Error('Notion Integration Secret is required.');
        const r = await timedFetchJson('https://api.notion.com/v1/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
          },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.object === 'user') {
          ok = true;
          verifiedAccount = r.json.name || r.json.bot?.workspace_name || 'Notion Bot';
          message = `Connected Notion integration "${verifiedAccount}".`;
        } else {
          message = r.json?.message || `Notion HTTP ${r.status} verification failed.`;
        }
        break;
      }

      case 'stripe': {
        const key = fields.secretKey || '';
        if (!key) throw new Error('Stripe secret key is required.');
        const r = await timedFetchJson('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.object === 'balance') {
          ok = true;
          verifiedAccount = r.json.livemode ? 'Live Mode' : 'Test Sandbox';
          message = `Verified Stripe API key (${verifiedAccount}).`;
        } else {
          message = r.json?.error?.message || `Stripe HTTP ${r.status} rejected secret key.`;
        }
        break;
      }

      case 'cloudflare': {
        const token = fields.apiToken || '';
        if (!token) throw new Error('Cloudflare API token is required.');
        const r = await timedFetchJson('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.success) {
          ok = true;
          verifiedAccount = r.json.result?.status || 'active';
          message = `Cloudflare token verified (status: ${verifiedAccount}).`;
        } else {
          message = r.json?.errors?.[0]?.message || `Cloudflare HTTP ${r.status} verification failed.`;
        }
        break;
      }

      case 'supabase': {
        const url = fields.projectUrl || '';
        const anonKey = fields.anonKey || '';
        if (!url || !anonKey) throw new Error('Supabase Project URL and key are required.');
        const check = await validatePluginOutboundUrl(url);
        if (!check.ok) throw new Error(check.reason);
        const r = await timedFetchJson(`${check.parsedUrl.origin}/rest/v1/`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        latencyMs = r.latencyMs;
        if (r.status >= 200 && r.status < 400) {
          ok = true;
          verifiedAccount = check.parsedUrl.hostname;
          message = `Supabase PostgREST endpoint reachable at ${verifiedAccount}.`;
        } else {
          message = r.json?.message || `Supabase returned HTTP ${r.status}.`;
        }
        break;
      }

      case 'elevenlabs': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('ElevenLabs API key is required.');
        const r = await timedFetchJson('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': key },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.subscription) {
          ok = true;
          const tier = r.json.subscription.tier || 'active';
          verifiedAccount = `${tier} (${r.json.subscription.character_count ?? 0}/${r.json.subscription.character_limit ?? 0} chars)`;
          message = `Verified ElevenLabs subscription: ${verifiedAccount}.`;
        } else {
          message = r.json?.detail?.message || `ElevenLabs HTTP ${r.status} rejected API key.`;
        }
        break;
      }

      case 'spotify': {
        const clientId = fields.clientId || '';
        const clientSecret = fields.clientSecret || '';
        if (!clientId || !clientSecret) throw new Error('Spotify Client ID and Secret are required.');
        const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const r = await timedFetchJson('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.access_token) {
          ok = true;
          verifiedAccount = `Client ${clientId.slice(0, 8)}...`;
          message = `Obtained valid Spotify OAuth client token (${r.json.token_type || 'Bearer'}).`;
        } else {
          message = r.json?.error_description || `Spotify HTTP ${r.status} authentication failed.`;
        }
        break;
      }

      case 'freesound': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('Freesound API key is required.');
        const r = await timedFetchJson(
          `https://freesound.org/apiv2/search/text/?query=ambient&page_size=1`,
          { headers: { Authorization: `Token ${key}` } }
        );
        latencyMs = r.latencyMs;
        if (r.ok && typeof r.json?.count === 'number') {
          ok = true;
          verifiedAccount = `${r.json.count} catalog sounds`;
          message = `Verified Freesound API v2 access (${verifiedAccount}).`;
        } else {
          message = r.json?.detail || `Freesound HTTP ${r.status} rejected token.`;
        }
        break;
      }

      case 'resend': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('Resend API key is required.');
        const r = await timedFetchJson('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok) {
          ok = true;
          const count = Array.isArray(r.json?.data) ? r.json.data.length : 0;
          verifiedAccount = `${count} domain(s)`;
          message = `Resend API verified (${count} sending domain(s) configured).`;
        } else {
          message = r.json?.message || `Resend HTTP ${r.status} verification failed.`;
        }
        break;
      }

      case 'tavily': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('Tavily API key is required.');
        const r = await timedFetchJson('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key, query: 'RaOne', max_results: 1 }),
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.results)) {
          ok = true;
          verifiedAccount = 'Search Ready';
          message = `Tavily Search API verified (${r.json.results.length} test citation returned).`;
        } else {
          message = r.json?.detail || r.json?.error || `Tavily HTTP ${r.status} failed.`;
        }
        break;
      }

      case 'google_workspace': {
        const token = fields.accessToken || '';
        if (!token) throw new Error('Google Workspace OAuth access token is required.');
        const r = await timedFetchJson('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.user) {
          ok = true;
          verifiedAccount = r.json.user.emailAddress || r.json.user.displayName;
          message = `Verified Google Drive session for ${verifiedAccount}.`;
        } else {
          message = r.json?.error?.message || `Google Drive HTTP ${r.status} token rejected or expired.`;
        }
        break;
      }

      case 'gemini': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('Gemini API key is required.');
        const r = await timedFetchJson(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
        );
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.models)) {
          ok = true;
          verifiedAccount = `${r.json.models.length} Gemini models`;
          message = `Verified Gemini API key (${verifiedAccount} accessible).`;
        } else {
          message = r.json?.error?.message || `Gemini HTTP ${r.status} key check failed.`;
        }
        break;
      }

      case 'groq': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('Groq API key is required.');
        const r = await timedFetchJson('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.data)) {
          ok = true;
          verifiedAccount = `${r.json.data.length} LPU models`;
          message = `Verified Groq API key (${verifiedAccount} active).`;
        } else {
          message = r.json?.error?.message || `Groq HTTP ${r.status} key check failed.`;
        }
        break;
      }

      case 'openai': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('OpenAI API key is required.');
        const r = await timedFetchJson('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.data)) {
          ok = true;
          verifiedAccount = `${r.json.data.length} models`;
          message = `Verified OpenAI key (${verifiedAccount} available).`;
        } else {
          message = r.json?.error?.message || `OpenAI HTTP ${r.status} rejected key.`;
        }
        break;
      }

      case 'anthropic': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('Anthropic API key is required.');
        const r = await timedFetchJson('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.data)) {
          ok = true;
          verifiedAccount = `${r.json.data.length} Claude models`;
          message = `Verified Anthropic key (${verifiedAccount} ready).`;
        } else {
          message = r.json?.error?.message || `Anthropic HTTP ${r.status} rejected key.`;
        }
        break;
      }

      case 'deepseek': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('DeepSeek API key is required.');
        const r = await timedFetchJson('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.data)) {
          ok = true;
          verifiedAccount = `${r.json.data.length} DeepSeek models`;
          message = `Verified DeepSeek key (${verifiedAccount}).`;
        } else {
          message = r.json?.error?.message || `DeepSeek HTTP ${r.status} rejected key.`;
        }
        break;
      }

      case 'xai': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('xAI API key is required.');
        const r = await timedFetchJson('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.data)) {
          ok = true;
          verifiedAccount = `${r.json.data.length} Grok models`;
          message = `Verified xAI Grok key (${verifiedAccount}).`;
        } else {
          message = r.json?.error?.message || `xAI HTTP ${r.status} rejected key.`;
        }
        break;
      }

      case 'cometapi': {
        const key = fields.apiKey || '';
        const base = (fields.baseUrl || 'https://api.cometapi.com/v1').replace(/\/+$/, '');
        if (!key) throw new Error('CometAPI key is required.');
        const urlCheck = await validatePluginOutboundUrl(base);
        if (!urlCheck.ok) throw new Error(urlCheck.reason);
        const r = await timedFetchJson(`${base}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.data)) {
          ok = true;
          verifiedAccount = `${r.json.data.length} gateway models`;
          message = `CometAPI Gateway online (${verifiedAccount}).`;
        } else {
          message = r.json?.error?.message || `CometAPI HTTP ${r.status} failed.`;
        }
        break;
      }

      case 'local_llm': {
        const baseUrl = fields.baseUrl || '';
        if (!baseUrl) throw new Error('Local LLM endpoint URL is required.');
        const localCheck = await validateLocalLlmEndpoint(baseUrl);
        if (!localCheck.ok) throw new Error(localCheck.reason || 'Invalid local endpoint URL.');
        const models = await fetchOpenAiCompatibleModels(baseUrl, fields.apiKey);
        latencyMs = Date.now() - startedAt;
        ok = true;
        verifiedAccount = models[0] || localCheck.normalizedBaseUrl;
        message = models.length > 0
          ? `Local runtime reachable (${models.length} model(s): ${models.slice(0, 3).join(', ')}).`
          : `Local loopback endpoint validated at ${localCheck.normalizedBaseUrl}.`;
        break;
      }

      case 'slack_discord': {
        const webhookUrl = fields.webhookUrl || '';
        if (!webhookUrl) throw new Error('Webhook URL is required.');
        const check = await validatePluginOutboundUrl(webhookUrl);
        if (!check.ok) throw new Error(check.reason);
        const webhookHost = check.parsedUrl.hostname.toLowerCase();
        const isDiscordHost =
          webhookHost === 'discord.com' ||
          webhookHost.endsWith('.discord.com') ||
          webhookHost === 'discordapp.com' ||
          webhookHost.endsWith('.discordapp.com');
        if (isDiscordHost) {
          const r = await timedFetchJson(check.parsedUrl.toString(), { method: 'GET' });
          latencyMs = r.latencyMs;
          if (r.ok && r.json?.id) {
            ok = true;
            verifiedAccount = r.json.name || `Discord #${r.json.channel_id || 'webhook'}`;
            message = `Discord webhook verified cleanly (${verifiedAccount}) without spamming channel.`;
          } else {
            message = r.json?.message || `Discord webhook returned HTTP ${r.status}.`;
          }
        } else if (check.parsedUrl.hostname === 'hooks.slack.com') {
          ok = check.parsedUrl.pathname.startsWith('/services/');
          latencyMs = Date.now() - startedAt;
          verifiedAccount = fields.channelLabel || 'hooks.slack.com';
          message = ok
            ? `Slack Incoming Webhook HTTPS endpoint & DNS verified (${verifiedAccount}).`
            : 'Slack webhook URL should begin with /services/...';
        } else {
          const r = await timedFetchJson(check.parsedUrl.toString(), { method: 'HEAD' });
          latencyMs = r.latencyMs;
          ok = r.status < 500;
          verifiedAccount = check.parsedUrl.hostname;
          message = ok
            ? `Webhook endpoint reachable (HTTP ${r.status}).`
            : `Webhook endpoint returned HTTP ${r.status}.`;
        }
        break;
      }

      case 'youtube': {
        const key = fields.apiKey || '';
        if (!key) throw new Error('YouTube Data API key is required.');
        const r = await timedFetchJson(
          `https://www.googleapis.com/youtube/v3/i18nRegions?part=snippet&key=${encodeURIComponent(key)}`
        );
        latencyMs = r.latencyMs;
        if (r.ok && Array.isArray(r.json?.items)) {
          ok = true;
          verifiedAccount = 'YouTube v3 Active';
          message = `YouTube Data v3 key verified (${r.json.items.length} regions).`;
        } else {
          message = r.json?.error?.message || `YouTube HTTP ${r.status} rejected API key.`;
        }
        break;
      }

      case 'mux': {
        const id = fields.tokenId || '';
        const secret = fields.tokenSecret || '';
        if (!id || !secret) throw new Error('Mux Token ID and Secret are required.');
        const auth = Buffer.from(`${id}:${secret}`).toString('base64');
        const r = await timedFetchJson('https://api.mux.com/video/v1/assets?limit=1', {
          headers: { Authorization: `Basic ${auth}` },
        });
        latencyMs = r.latencyMs;
        if (r.ok) {
          ok = true;
          verifiedAccount = `Token ${id.slice(0, 8)}...`;
          message = 'Mux Video API credentials verified cleanly.';
        } else {
          message = r.json?.error?.messages?.[0] || `Mux HTTP ${r.status} verification failed.`;
        }
        break;
      }

      case 'cloudinary': {
        const cloudName = fields.cloudName || '';
        const apiKey = fields.apiKey || '';
        const apiSecret = fields.apiSecret || '';
        if (!cloudName || !apiKey || !apiSecret) {
          throw new Error('Cloud Name, API Key, and API Secret are required.');
        }
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const r = await timedFetchJson(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/ping`,
          { headers: { Authorization: `Basic ${auth}` } }
        );
        latencyMs = r.latencyMs;
        if (r.ok && r.json?.status === 'ok') {
          ok = true;
          verifiedAccount = cloudName;
          message = `Cloudinary workspace "${cloudName}" responded ok.`;
        } else {
          message = r.json?.error?.message || `Cloudinary HTTP ${r.status} failed.`;
        }
        break;
      }

      case 'firebase': {
        const projectId = fields.projectId || '';
        if (!projectId) throw new Error('Firebase Project ID is required.');
        if (fields.webApiKey && fields.webApiKey.startsWith('AIza')) {
          const r = await timedFetchJson(
            `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(fields.webApiKey)}`
          );
          latencyMs = r.latencyMs;
          // identitytoolkit returns 400/403 or 200; specifically API_KEY_INVALID indicates bad key
          const errMsg = r.json?.error?.message || '';
          if (r.ok || !errMsg.includes('API_KEY_INVALID')) {
            ok = true;
            verifiedAccount = projectId;
            message = `Firebase Project "${projectId}" & Web API Key verified.`;
          } else {
            message = errMsg || 'Invalid Firebase Web API key.';
          }
        } else {
          ok = /^[a-z0-9-]{4,64}$/i.test(projectId);
          latencyMs = Date.now() - startedAt;
          verifiedAccount = projectId;
          message = ok
            ? `Firebase Project ID "${projectId}" format bound cleanly for deployments.`
            : 'Invalid Firebase Project ID format.';
        }
        break;
      }

      case 'postgresql': {
        const uri = fields.connectionUri || '';
        if (!uri) throw new Error('Connection URI is required.');
        let parsed: URL;
        try {
          parsed = new URL(uri);
        } catch {
          throw new Error('Invalid database connection URI format.');
        }
        const host = parsed.hostname.toLowerCase();
        if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || net.isIP(host) !== 0) {
          throw new Error('Public database hostname required for cloud vault URI.');
        }
        const recs = await dns.lookup(host, { all: true });
        if (recs.some((r) => isPrivateOrReservedIp(r.address))) {
          throw new Error('Database host resolves to a blocked private/reserved IP.');
        }
        ok = true;
        latencyMs = Date.now() - startedAt;
        verifiedAccount = `${parsed.protocol.replace(':', '')}://${host}`;
        message = `Database URI validated and DNS resolved cleanly (${host}).`;
        break;
      }

      case 'runway_luma': {
        const url = fields.providerUrl || '';
        const apiKey = fields.apiKey || '';
        if (!url || !apiKey) throw new Error('Provider URL and API Key are required.');
        const check = await validatePluginOutboundUrl(url);
        if (!check.ok) throw new Error(check.reason);
        const r = await timedFetchJson(check.parsedUrl.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        latencyMs = r.latencyMs;
        ok = r.status < 500 && r.status !== 401 && r.status !== 403;
        verifiedAccount = check.parsedUrl.hostname;
        message = ok
          ? `Video gateway reachable at ${verifiedAccount} (HTTP ${r.status}).`
          : `Gateway ${verifiedAccount} returned HTTP ${r.status}.`;
        break;
      }

      default: {
        // Custom plugin health probe
        if (resolved.customDef) {
          const def = resolved.customDef;
          const targetBase = String(fields.baseUrlOverride || def.baseUrl || '').trim().replace(/\/+$/, '');
          const healthCheck = validatePluginHealthPath(def.healthPath || '/');
          if (!healthCheck.ok) throw new Error(healthCheck.reason);
          const healthPath = healthCheck.value;
          const targetUrl = `${targetBase}${healthPath === '/' ? '' : healthPath}`;
          const check = await validatePluginOutboundUrl(targetUrl);
          if (!check.ok) throw new Error(check.reason);

          const headers: Record<string, string> = {};
          const secret = fields.apiKey || '';
          if (def.authScheme !== 'None' && secret) {
            const headerCheck = validatePluginHeaderName(def.authHeaderName || 'Authorization');
            if (!headerCheck.ok) throw new Error(headerCheck.reason);
            headers[headerCheck.value] =
              def.authScheme === 'Bearer' ? `Bearer ${secret}` : secret;
          }
          const r = await timedFetchJson(check.parsedUrl.toString(), {
            method: 'GET',
            headers,
          });
          latencyMs = r.latencyMs;
          ok = r.ok;
          verifiedAccount = check.parsedUrl.hostname;
          message = ok
            ? `Custom endpoint ${check.parsedUrl.hostname} responded HTTP ${r.status} in ${latencyMs}ms.`
            : `Endpoint responded HTTP ${r.status}: ${r.json?.error || r.text?.slice(0, 120) || 'Failed'}`;
        } else {
          throw new Error(`No live verifier registered for ${opts.pluginId}.`);
        }
      }
    }
  } catch (err: any) {
    ok = false;
    latencyMs = latencyMs || Date.now() - startedAt;
    message = err?.name === 'AbortError'
      ? 'Connection timed out after 8 seconds.'
      : err?.message || 'Verification failed.';
  }

  // Persist test status cleanly if plugin exists in vault (or keep existing secrets untouched)
  await mutateTenantCollection<PluginVaultMap>(opts.tenantId, 'plugins_vault', {}, (current) => {
    const existing = current[opts.pluginId];
    if (!existing) return current;
    return {
      ...current,
      [opts.pluginId]: {
        ...existing,
        lastTestedAt: testedAt,
        lastTestOk: ok,
        lastTestLatencyMs: latencyMs,
        lastTestMessage: message,
        verifiedAccount,
      },
    };
  });

  return {
    ok,
    latencyMs,
    message,
    verifiedAccount,
    testedAt,
  };
}

// =========================================================================
// Dispatch Outbound Webhook Event (Slack / Discord / Custom Webhook Bridge)
// =========================================================================
export async function dispatchPluginWebhook(opts: {
  tenantId: string;
  pluginId?: string;
  studio?: PluginStudioScope;
  eventTitle: string;
  summary: string;
  url?: string;
}): Promise<{ ok: boolean; status: number; message: string }> {
  const targetId = opts.pluginId || 'slack_discord';
  const fields = await getDecryptedPluginFields(opts.tenantId, targetId);
  const webhookUrl = fields.webhookUrl || '';
  if (!webhookUrl) {
    throw new Error('Slack & Discord Webhooks plugin is not connected.');
  }
  const check = await validatePluginOutboundUrl(webhookUrl);
  if (!check.ok) throw new Error(check.reason);

  const webhookHost = check.parsedUrl.hostname.toLowerCase();
  const isDiscord =
    webhookHost === 'discord.com' ||
    webhookHost.endsWith('.discord.com') ||
    webhookHost === 'discordapp.com' ||
    webhookHost.endsWith('.discordapp.com');

  const payload = isDiscord
    ? {
        content: `**${opts.eventTitle}**\n${opts.summary}${opts.url ? `\n${opts.url}` : ''}`,
      }
    : {
        text: `*${opts.eventTitle}*\n${opts.summary}${opts.url ? `\n${opts.url}` : ''}`,
      };

  const r = await timedFetchJson(check.parsedUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return {
    ok: r.ok,
    status: r.status,
    message: r.ok ? 'Webhook event delivered cleanly.' : `Webhook returned HTTP ${r.status}.`,
  };
}
