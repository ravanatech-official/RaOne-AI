export type PluginCategory =
  | 'code'
  | 'ai_models'
  | 'vision'
  | 'cinema'
  | 'music'
  | 'document'
  | 'custom';

export type PluginStudioScope =
  | 'code'
  | 'vision'
  | 'cinema'
  | 'music'
  | 'document';

export interface PluginFieldDef {
  key: string;
  label: string;
  type: 'secret' | 'text' | 'url';
  placeholder: string;
  required?: boolean;
  helper?: string;
}

export interface PluginCatalogEntry {
  id: string;
  name: string;
  provider: string;
  category: PluginCategory;
  description: string;
  shortTag: string;
  studios: PluginStudioScope[];
  authType: 'api_key' | 'pat' | 'webhook' | 'oauth_token' | 'endpoint';
  docsUrl: string;
  getKeyUrl?: string;
  capabilities: string[];
  fields: PluginFieldDef[];
  supportsLiveTest: boolean;
  byokMapping?: boolean;
}

export interface CustomPluginDefinition {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  healthPath: string;
  authHeaderName: string;
  authScheme: 'Bearer' | 'X-Api-Key' | 'Custom' | 'None';
  description: string;
  studios: PluginStudioScope[];
  capabilities: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface PluginPublicView extends PluginCatalogEntry {
  isConnected: boolean;
  enabled: boolean;
  bookmarked: boolean;
  enabledStudios: PluginStudioScope[];
  maskedFields: Record<string, string>;
  publicFields: Record<string, string>;
  source: 'vault' | 'byok' | 'server_env' | 'none';
  connectedAt?: string | null;
  updatedAt?: string | null;
  lastTestedAt?: string | null;
  lastTestOk?: boolean | null;
  lastTestLatencyMs?: number | null;
  lastTestMessage?: string | null;
  verifiedAccount?: string | null;
  isCustom?: boolean;
  customDef?: CustomPluginDefinition;
}

export interface PluginLibraryStats {
  total: number;
  connected: number;
  enabled: number;
  bookmarked: number;
  customCount: number;
  byCategory: Record<PluginCategory, number>;
  byStudio: Record<PluginStudioScope, { total: number; connected: number }>;
}

export const PLUGIN_STUDIO_LABELS: Record<PluginStudioScope, string> = {
  code: 'Code Studio',
  vision: 'Vision Studio',
  cinema: 'Cinema Studio',
  music: 'Music Studio',
  document: 'Document Studio',
};

export const PLUGIN_CATEGORY_META: Record<
  PluginCategory,
  { label: string; subtitle: string }
> = {
  code: {
    label: 'Code & Cloud',
    subtitle: 'GitHub, Firebase, Vercel, Supabase, Cloudflare, Stripe, DBs',
  },
  ai_models: {
    label: 'AI Model Engines',
    subtitle: 'Gemini, Groq, OpenAI, Claude, DeepSeek, xAI, CometAPI, Local LLM',
  },
  vision: {
    label: 'Vision & Design',
    subtitle: 'Hugging Face, Replicate, Fal.ai, Figma, Cloudinary CDN',
  },
  cinema: {
    label: 'Cinema & Video',
    subtitle: 'Runway / Luma / Kling Gateways, Mux Streaming, YouTube API',
  },
  music: {
    label: 'Music & Audio',
    subtitle: 'ElevenLabs Voice & SFX, Spotify Web API, Freesound Library',
  },
  document: {
    label: 'Docs, Search & Comms',
    subtitle: 'Notion, Google Workspace, Tavily Search, Resend, Slack & Discord',
  },
  custom: {
    label: 'Custom & MCP Plugins',
    subtitle: 'User-defined REST APIs, private gateways, and webhook bridges',
  },
};
