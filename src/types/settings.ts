import {
  DEFAULT_PROJECT_CONFIG,
  type PromptEnhanceDepth,
  type StudioProjectConfig,
} from './studio.ts';
import {
  DEFAULT_CINEMA_CONFIG,
  type CinemaConfig,
} from './cinema.ts';
import {
  DEFAULT_MUSIC_CONFIG,
  type MusicConfig,
} from './music.ts';
import {
  DEFAULT_DOCUMENT_CONFIG,
  type DocumentConfig,
} from './document.ts';
import {
  VISION_MODELS,
  DEFAULT_DARKROOM,
} from '../data/visionPresets.ts';

export type SettingsSectionId =
  | 'general'
  | 'personalization'
  | 'models'
  | 'speech'
  | 'code_studio'
  | 'vision_studio'
  | 'cinema_studio'
  | 'music_studio'
  | 'document_studio'
  | 'files_library'
  | 'plugins_library'
  | 'datacontrols'
  | 'security'
  | 'account'
  | 'diagnostics';

export interface VisionStudioDefaults {
  model: string;
  style: string;
  aspectRatio: string;
  resolution: '1K' | '2K' | '4K';
  imageCount: number;
  cfgScale: number;
  steps: number;
  photoReal: boolean;
  alchemy: boolean;
  promptMagic: boolean;
  googleSearchGrounding: boolean;
  enhancerMode: string;
  negativePrompt: string;
  exportFormat: 'png' | 'jpeg' | 'webp';
  defaultWarmth: number;
  defaultContrast: number;
}

export interface CodeStudioDefaults extends StudioProjectConfig {
  enhanceDepth: PromptEnhanceDepth;
  autoAuditOnBuild: boolean;
}

export interface FilesLibrarySettings {
  defaultViewMode: 'grid' | 'list';
  defaultSortMode: 'newest' | 'oldest' | 'size' | 'title';
  autoIndexStudios: {
    code: boolean;
    vision: boolean;
    cinema: boolean;
    music: boolean;
    document: boolean;
  };
  zipIncludeMetadataJson: boolean;
  ocrFallbackOnUpload: boolean;
  trashRetentionDays: 7 | 30 | 90 | 0;
  confirmBeforeTrash: boolean;
}

export interface PluginsLibrarySettings {
  enforceStrictSsrf: boolean;
  maskAllSecretsInApi: boolean;
  autoSyncByokKeys: boolean;
  autoWebhookOnComplete: {
    code: boolean;
    vision: boolean;
    cinema: boolean;
    music: boolean;
    document: boolean;
  };
}

export interface UniversalSettingsProfile {
  theme: 'system' | 'dark' | 'light';
  language: string;
  defaultWorkspace: 'chat' | 'library' | 'plugins' | 'code_studio' | 'vision_studio' | 'cinema_studio' | 'music_studio' | 'document_studio';
  alwaysShowCode: boolean;
  compactDensity: boolean;
  activeProvider: 'auto' | 'gemini' | 'groq' | 'local';
  selectedModel: string;
  fallbackOnRateLimit: boolean;
  globalEnhancerDepth: PromptEnhanceDepth;
  customInstructions: {
    aboutUser: string;
    responseStyle: string;
    enabled: boolean;
    bilingualMode: boolean;
  };
  memory: {
    enabled: boolean;
    items: string[];
  };
  voice: {
    selectedVoice: string;
    speechLanguage: string;
    wakeWordEnabled: boolean;
    autoSpeakResponses: boolean;
    reducedMotion: boolean;
  };
  dataControls: {
    historyAndTraining: boolean;
    temporaryChatDefault: boolean;
  };
  studioDefaults: {
    code: CodeStudioDefaults;
    vision: VisionStudioDefaults;
    cinema: CinemaConfig;
    music: MusicConfig;
    document: DocumentConfig;
  };
  libraries: {
    files: FilesLibrarySettings;
    plugins: PluginsLibrarySettings;
  };
  security?: {
    mfaEnabled?: boolean;
  };
}

export interface UniversalDiagnosticsSnapshot {
  checkedAt: string;
  serverHealthy: boolean;
  runtime: {
    nodeVersion: string;
    platform: string;
    isCloudRun: boolean;
    ffmpegAvailable: boolean;
    ffprobeAvailable: boolean;
    llamaServerAvailable: boolean;
    managedLlamaRunning: boolean;
  };
  providers: {
    geminiReady: boolean;
    groqReady: boolean;
    openAiReady: boolean;
    anthropicReady: boolean;
    deepSeekReady: boolean;
    xaiReady: boolean;
    cometReady: boolean;
    localLlmReady: boolean;
  };
  vaults: {
    pluginsTotal: number;
    pluginsConnected: number;
    pluginsEnabled: number;
    customPlugins: number;
    creditsBalance: number;
    plan: string;
  };
  storage: {
    totalAssets: number;
    totalBytes: number;
    trashedCount: number;
    byStudio: {
      code: { count: number; bytes: number };
      vision: { count: number; bytes: number };
      cinema: { count: number; bytes: number };
      music: { count: number; bytes: number };
      document: { count: number; bytes: number };
    };
  };
}

export const DEFAULT_UNIVERSAL_SETTINGS: UniversalSettingsProfile = {
  theme: 'dark',
  language: 'auto',
  defaultWorkspace: 'chat',
  alwaysShowCode: true,
  compactDensity: false,
  activeProvider: 'auto',
  selectedModel: 'gemini-4-hydrogen',
  fallbackOnRateLimit: true,
  globalEnhancerDepth: 'fullstack',
  customInstructions: {
    aboutUser:
      'Software Engineer & Builder, prefers precise, complete, and high-level architectural solutions.',
    responseStyle:
      'Address me with high clarity and formidable capability. Support both Sinhala and English fluently. Sign responses with RaOne AI by RavanaTec — Think. Create. Act.',
    enabled: true,
    bilingualMode: true,
  },
  memory: {
    enabled: true,
    items: [
      'Lives in Sri Lanka and prefers Colombo/IST timezone',
      'Prefers clean React 19 + TypeScript + Tailwind CSS code',
      'Communicates bilingually in Sinhala and English (Singlish supported)',
      'Prefers Dark Mode UI with high contrast',
    ],
  },
  voice: {
    selectedVoice: 'Breeze',
    speechLanguage: 'auto',
    wakeWordEnabled: false,
    autoSpeakResponses: false,
    reducedMotion: false,
  },
  dataControls: {
    historyAndTraining: false,
    temporaryChatDefault: false,
  },
  studioDefaults: {
    code: {
      ...DEFAULT_PROJECT_CONFIG,
      enhanceDepth: 'fullstack',
      autoAuditOnBuild: true,
    },
    vision: {
      model: VISION_MODELS[0]?.id || 'Flux 1.1 Pro (LDM)',
      style: 'Cinematic Photoreal',
      aspectRatio: '16:9',
      resolution: '1K',
      imageCount: 2,
      cfgScale: 7.5,
      steps: 40,
      photoReal: true,
      alchemy: true,
      promptMagic: true,
      googleSearchGrounding: false,
      enhancerMode: 'auto',
      negativePrompt: 'blurry, low resolution, deformed, bad anatomy, artifacts, watermark',
      exportFormat: 'png',
      defaultWarmth: DEFAULT_DARKROOM.warmth,
      defaultContrast: DEFAULT_DARKROOM.contrast,
    },
    cinema: {
      ...DEFAULT_CINEMA_CONFIG,
    },
    music: {
      ...DEFAULT_MUSIC_CONFIG,
    },
    document: {
      ...DEFAULT_DOCUMENT_CONFIG,
    },
  },
  libraries: {
    files: {
      defaultViewMode: 'grid',
      defaultSortMode: 'newest',
      autoIndexStudios: {
        code: true,
        vision: true,
        cinema: true,
        music: true,
        document: true,
      },
      zipIncludeMetadataJson: true,
      ocrFallbackOnUpload: true,
      trashRetentionDays: 30,
      confirmBeforeTrash: false,
    },
    plugins: {
      enforceStrictSsrf: true,
      maskAllSecretsInApi: true,
      autoSyncByokKeys: true,
      autoWebhookOnComplete: {
        code: false,
        vision: false,
        cinema: false,
        music: false,
        document: false,
      },
    },
  },
  security: {
    mfaEnabled: false,
  },
};
