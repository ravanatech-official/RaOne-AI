export type ProjectCategoryId =
  | 'website'
  | 'webapp'
  | 'saas'
  | 'micro_saas'
  | 'fullstack'
  | 'browser_extension'
  | 'api_service'
  | 'script_cli'
  | 'mobile_pwa';

export type FrontendFrameworkId =
  | 'none'
  | 'vanilla_tailwind'
  | 'react_vite'
  | 'nextjs'
  | 'vue_vite'
  | 'canvas_threejs';

export type BackendRuntimeId =
  | 'none'
  | 'node_express'
  | 'node_fastify'
  | 'python_fastapi'
  | 'go_gin'
  | 'edge_worker';

export type DatabaseEngineId =
  | 'localstorage'
  | 'firestore'
  | 'postgresql'
  | 'sqlite'
  | 'supabase';

export type ScriptLanguageId =
  | 'typescript'
  | 'python'
  | 'javascript'
  | 'go'
  | 'rust'
  | 'bash'
  | 'sql';

export type AuthProviderId = 'none' | 'firebase_auth' | 'jwt_custom' | 'oauth2';
export type PaymentProviderId = 'none' | 'stripe' | 'lemonsqueezy';
export type DeployTargetId = 'raone_live' | 'firebase' | 'cloud_run' | 'github';
export type PromptEnhanceDepth = 'quick' | 'fullstack' | 'enterprise';

export type IntegrationToolId =
  | 'firebase_sdk'
  | 'google_maps'
  | 'stripe_billing'
  | 'email_resend'
  | 'ai_proxy'
  | 'websockets'
  | 'charts_analytics'
  | 'webhook_triggers';

export interface StudioProjectConfig {
  category: ProjectCategoryId;
  frontendFramework: FrontendFrameworkId;
  backendRuntime: BackendRuntimeId;
  database: DatabaseEngineId;
  scriptLanguage: ScriptLanguageId;
  authProvider: AuthProviderId;
  paymentProvider: PaymentProviderId;
  deployTarget: DeployTargetId;
  integrations: IntegrationToolId[];
  codingParams: {
    strictTypeScript: boolean;
    architecturePattern: 'modular_clean' | 'mvc_layered' | 'single_bundle';
    responsiveMobileFirst: boolean;
    themeMode: 'dark' | 'light' | 'system_toggle';
    includeSeoMeta: boolean;
    includePwaManifest: boolean;
    includeUnitTests: boolean;
    includeDocker: boolean;
    includeCiCd: boolean;
    securityHardening: boolean;
  };
  customDependencies: string[];
  envVariables: string[];
  deployConfig: {
    firebaseProjectId?: string;
    gcpRegion?: string;
    cloudRunService?: string;
    githubRepo?: string;
    githubBranch?: string;
  };
}

export interface StudioAuditFinding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'security' | 'syntax' | 'performance' | 'accessibility' | 'seo' | 'architecture';
  file: string;
  title: string;
  description: string;
  fixHint: string;
}

export interface StudioAuditReport {
  score: number;
  passedChecks: number;
  totalChecks: number;
  criticalCount: number;
  warningCount: number;
  auditedAt: string;
  summary: string;
  findings: StudioAuditFinding[];
}

export interface StudioDependencyItem {
  name: string;
  version: string;
  ecosystem: 'npm' | 'pip' | 'cargo' | 'go' | 'cdn';
  source: 'detected' | 'config' | 'manual';
  purpose?: string;
}

export interface CategoryCatalogItem {
  id: ProjectCategoryId;
  label: string;
  shortDesc: string;
  recommendedPreset: Partial<StudioProjectConfig>;
  samplePrompt: string;
}

export const CATEGORY_CATALOG: CategoryCatalogItem[] = [
  {
    id: 'webapp',
    label: 'Web App (SPA)',
    shortDesc: 'Interactive browser app with local state & modular UI',
    samplePrompt: 'Real-time personal finance dashboard with budget envelopes & CSV import',
    recommendedPreset: {
      frontendFramework: 'react_vite',
      backendRuntime: 'none',
      database: 'localstorage',
      authProvider: 'none',
      paymentProvider: 'none',
    },
  },
  {
    id: 'website',
    label: 'Website / Landing',
    shortDesc: 'SEO-optimized marketing site, portfolio or product showcase',
    samplePrompt: 'Editorial architecture studio showcase with project filter & booking form',
    recommendedPreset: {
      frontendFramework: 'vanilla_tailwind',
      backendRuntime: 'none',
      database: 'localstorage',
      authProvider: 'none',
      paymentProvider: 'none',
    },
  },
  {
    id: 'saas',
    label: 'SaaS Platform',
    shortDesc: 'Multi-tenant platform with Auth, DB, billing & analytics',
    samplePrompt: 'B2B team CRM & deal pipeline SaaS with workspaces, roles & revenue analytics',
    recommendedPreset: {
      frontendFramework: 'nextjs',
      backendRuntime: 'node_express',
      database: 'postgresql',
      authProvider: 'firebase_auth',
      paymentProvider: 'stripe',
    },
  },
  {
    id: 'micro_saas',
    label: 'Micro-SaaS',
    shortDesc: 'Lean single-purpose paid product with fast MVP backend',
    samplePrompt: 'Automated invoice & retainer portal for freelance consultants',
    recommendedPreset: {
      frontendFramework: 'react_vite',
      backendRuntime: 'node_express',
      database: 'firestore',
      authProvider: 'firebase_auth',
      paymentProvider: 'stripe',
    },
  },
  {
    id: 'fullstack',
    label: 'Full-Stack Software',
    shortDesc: 'Complete frontend + REST API server + database schema + tests',
    samplePrompt: 'Warehouse inventory & barcode scanner system with REST API & SQL schema',
    recommendedPreset: {
      frontendFramework: 'react_vite',
      backendRuntime: 'node_express',
      database: 'postgresql',
      authProvider: 'jwt_custom',
      paymentProvider: 'none',
    },
  },
  {
    id: 'browser_extension',
    label: 'Browser Extension (MV3)',
    shortDesc: 'Chrome/Edge/Firefox Manifest V3 extension + live popup simulator',
    samplePrompt: 'Tab focus & distraction blocker extension with daily productivity stats',
    recommendedPreset: {
      frontendFramework: 'vanilla_tailwind',
      backendRuntime: 'none',
      database: 'localstorage',
      authProvider: 'none',
      paymentProvider: 'none',
    },
  },
  {
    id: 'api_service',
    label: 'API / Microservice',
    shortDesc: 'Production REST API backend + OpenAPI spec + tests + Docker',
    samplePrompt: 'Rate-limited webhook relay & job queue REST API with API key auth',
    recommendedPreset: {
      frontendFramework: 'none',
      backendRuntime: 'node_fastify',
      database: 'postgresql',
      authProvider: 'jwt_custom',
      paymentProvider: 'none',
    },
  },
  {
    id: 'script_cli',
    label: 'Script / CLI Tool',
    shortDesc: 'Python, Node/TS, Go, Rust, Bash or SQL automation utility',
    samplePrompt: 'Automated log parser & anomaly report CLI script with JSON/CSV output',
    recommendedPreset: {
      frontendFramework: 'none',
      backendRuntime: 'none',
      database: 'sqlite',
      scriptLanguage: 'python',
      authProvider: 'none',
      paymentProvider: 'none',
    },
  },
  {
    id: 'mobile_pwa',
    label: 'Mobile App / PWA',
    shortDesc: 'Installable offline-ready mobile-first progressive web app',
    samplePrompt: 'Offline-first workout interval & habit tracker mobile PWA',
    recommendedPreset: {
      frontendFramework: 'react_vite',
      backendRuntime: 'none',
      database: 'firestore',
      authProvider: 'firebase_auth',
      paymentProvider: 'none',
    },
  },
];

export const DEFAULT_PROJECT_CONFIG: StudioProjectConfig = {
  category: 'webapp',
  frontendFramework: 'react_vite',
  backendRuntime: 'node_express',
  database: 'localstorage',
  scriptLanguage: 'typescript',
  authProvider: 'none',
  paymentProvider: 'none',
  deployTarget: 'raone_live',
  integrations: [],
  codingParams: {
    strictTypeScript: true,
    architecturePattern: 'modular_clean',
    responsiveMobileFirst: true,
    themeMode: 'dark',
    includeSeoMeta: true,
    includePwaManifest: false,
    includeUnitTests: true,
    includeDocker: false,
    includeCiCd: false,
    securityHardening: true,
  },
  customDependencies: [],
  envVariables: [],
  deployConfig: {
    firebaseProjectId: 'raoneai',
    gcpRegion: 'us-central1',
    cloudRunService: 'raone-generated-app',
    githubRepo: '',
    githubBranch: 'main',
  },
};

export const INTEGRATION_OPTIONS: Array<{ id: IntegrationToolId; label: string; desc: string }> = [
  { id: 'firebase_sdk', label: 'Firebase SDK', desc: 'Firestore persistence & Auth hooks' },
  { id: 'google_maps', label: 'Google Maps', desc: 'Interactive maps & geolocation routes' },
  { id: 'stripe_billing', label: 'Stripe Checkout', desc: 'Subscriptions & webhook verification' },
  { id: 'email_resend', label: 'Transactional Email', desc: 'Resend / SMTP notification helper' },
  { id: 'ai_proxy', label: 'Server AI Route', desc: 'Secure /api/ai backend proxy handler' },
  { id: 'websockets', label: 'Realtime Sync', desc: 'WebSocket / live event channel' },
  { id: 'charts_analytics', label: 'Analytics Charts', desc: 'Chart.js KPI & trend visualizations' },
  { id: 'webhook_triggers', label: 'Webhook Engine', desc: 'Signed HMAC outbound webhooks' },
];
