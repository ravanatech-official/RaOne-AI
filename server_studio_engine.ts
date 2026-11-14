import crypto from 'crypto';
import vm from 'vm';
import { GoogleGenAI } from '@google/genai';
import {
  synthesizeFullProject,
  refineSynthesizedProject,
  type SynthesizedProject,
} from './server_app_synthesizer.ts';
import { callGroqChat, streamGroqChatToSSE } from './server_groq_service.ts';
import {
  getActiveLocalEndpointConfig,
  callLocalLlmChat,
  streamLocalLlmToSSE,
} from './server_local_llm.ts';
import { SYSTEM_PROMPT, appendRuntimeMetadata } from './src/lib/systemPrompts.ts';
import { validateSafeHttpsEgress } from './server_security.ts';
import type { ByokKeyMap } from './server_tenant_store.ts';
import {
  DEFAULT_PROJECT_CONFIG,
  type PromptEnhanceDepth,
  type StudioAuditReport,
  type StudioDependencyItem,
  type StudioProjectConfig,
} from './src/types/studio.ts';
import {
  analyzeProjectDependencies,
  runFullStudioAudit,
} from './server_studio_auditor.ts';

export type StudioBuildMode =
  | 'Default mode'
  | 'Prototype mode'
  | 'Fullstack mode'
  | 'Mobile mode';

export type StudioProviderChoice =
  | 'auto'
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'comet'
  | 'local';

export interface StudioVersionSnapshot {
  version: number;
  prompt: string;
  mode: string;
  providerUsed: string;
  modelUsed: string;
  createdAt: string;
  code: string;
  files: Record<string, string>;
}

export interface StudioTurnRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelLabel?: string;
  durationSec?: string;
  details?: string[];
  timestamp?: string;
}

export interface StudioPublishMeta {
  isPublished: boolean;
  shareId?: string;
  shareUrl?: string;
  publishedAt?: string;
}

export interface StudioDiagnostics {
  syntaxOk: boolean;
  errors: string[];
  warnings: string[];
  bundleBytes: number;
  fileCount: number;
  validatedAt: string;
}

export interface StudioAppAttachment {
  name: string;
  mimeType: string;
  kind: 'image' | 'text';
  data: string; // base64 for image, plain string for text
}

export interface RichStudioApp extends SynthesizedProject {
  mode: string;
  framework: string;
  providerUsed: string;
  modelUsed: string;
  files: Record<string, string> & {
    'index.html': string;
    'app.js': string;
    'styles.css': string;
    'architecture.md': string;
    'schema.json': string;
  };
  projectConfig?: StudioProjectConfig;
  auditReport?: StudioAuditReport;
  dependencies?: StudioDependencyItem[];
  envVariables?: string[];
  turns?: StudioTurnRecord[];
  versions?: StudioVersionSnapshot[];
  currentVersion?: number;
  publishMeta?: StudioPublishMeta;
  diagnostics?: StudioDiagnostics;
}

export interface PublishedSnapshotRecord {
  shareId: string;
  tenantId: string;
  appId: string;
  title: string;
  description: string;
  mode: string;
  code: string;
  publishedAt: string;
  updatedAt: string;
  views: number;
}

// =========================================================================
// HTML / Multi-File Decomposition, Compilation & Syntax Validation Gate
// =========================================================================
export function normalizeStudioMode(rawMode?: string): StudioBuildMode {
  const m = String(rawMode || '').toLowerCase();
  if (m.includes('prototype')) return 'Prototype mode';
  if (m.includes('fullstack')) return 'Fullstack mode';
  if (m.includes('mobile')) return 'Mobile mode';
  return 'Default mode';
}

export function decomposeHtmlIntoFiles(
  htmlCode: string,
  title: string,
  prompt: string,
  mode: StudioBuildMode,
  existingFiles?: Record<string, string>
): Record<string, string> & {
  'index.html': string;
  'app.js': string;
  'styles.css': string;
  'architecture.md': string;
  'schema.json': string;
} {
  const rawHtml = String(htmlCode || '').trim();
  const styleBlocks: string[] = [];
  const scriptBlocks: string[] = [];

  const cleanHtmlWithoutStylesAndScripts = rawHtml
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, cssBody) => {
      if (cssBody && cssBody.trim()) styleBlocks.push(cssBody.trim());
      return '';
    })
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, jsBody) => {
      if (/\bsrc\s*=/i.test(attrs || '')) {
        return full;
      }
      if (jsBody && jsBody.trim()) scriptBlocks.push(jsBody.trim());
      return '';
    });

  const extractedCss =
    styleBlocks.join('\n\n') ||
    existingFiles?.['styles.css'] ||
    '/* Tailwind CSS CDN utilities + Studio tokens */\n:root { color-scheme: dark; }\nbody { margin: 0; }';

  const extractedJs =
    scriptBlocks.join('\n\n') ||
    existingFiles?.['app.js'] ||
    '// Application interactive runtime\nconsole.log("RaOne app ready");';

  // Ensure index.html remains clean and readable while referencing styles.css and app.js logically
  let cleanIndexHtml = cleanHtmlWithoutStylesAndScripts
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanIndexHtml.includes('styles.css') && cleanIndexHtml.includes('</head>')) {
    cleanIndexHtml = cleanIndexHtml.replace(
      '</head>',
      '  <link rel="stylesheet" href="./styles.css" />\n</head>'
    );
  }
  if (!cleanIndexHtml.includes('app.js') && cleanIndexHtml.includes('</body>')) {
    cleanIndexHtml = cleanIndexHtml.replace(
      '</body>',
      '  <script src="./app.js"></script>\n</body>'
    );
  }

  const bundleHash = crypto.createHash('sha256').update(rawHtml).digest('hex').slice(0, 12);

  const schemaJson =
    existingFiles?.['schema.json'] ||
    JSON.stringify(
      {
        app: title,
        mode,
        bundleHash,
        persistence: mode === 'Fullstack mode' ? 'LocalStorage + Simulated REST Router' : 'LocalStorage',
        entities: [
          {
            name: 'records',
            primaryKey: 'id',
            fields: ['id', 'title', 'status', 'createdAt', 'updatedAt'],
          },
        ],
      },
      null,
      2
    );

  const architectureMd =
    existingFiles?.['architecture.md'] ||
    `# Architecture Specification: ${title}

- **Build Mode**: ${mode}
- **Bundle Hash**: \`${bundleHash}\`
- **Prompt Directive**: ${prompt}

## Modules & File Map
- \`index.html\`: Structural DOM layout & Tailwind design tokens
- \`styles.css\`: Custom animations, scrollbars, and theme variables
- \`app.js\`: Reactive state store, event handlers, and persistence
${mode === 'Fullstack mode' ? '- `api_routes.js`: Simulated client-side REST API router (`/api/app/*`)\n' : ''}- \`schema.json\`: Data model & storage schema
`;

  const files: Record<string, string> & {
    'index.html': string;
    'app.js': string;
    'styles.css': string;
    'architecture.md': string;
    'schema.json': string;
  } = {
    ...(existingFiles || {}),
    'index.html': existingFiles?.['index.html'] || cleanIndexHtml || rawHtml,
    'styles.css': existingFiles?.['styles.css'] || extractedCss,
    'app.js': existingFiles?.['app.js'] || extractedJs,
    'schema.json': schemaJson,
    'architecture.md': architectureMd,
  };

  if (mode === 'Fullstack mode' && !files['api_routes.js']) {
    files['api_routes.js'] = `// Simulated Fullstack REST API Bridge (/api/app/*)
window.__RAONE_API_ROUTES__ = {
  namespace: '${title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'app'}_api',
  getHealth: () => ({ status: 'ok', mode: 'fullstack-sandbox', timestamp: new Date().toISOString() }),
};`;
  }

  return files;
}

export function compileFilesIntoHtmlBundle(files: Record<string, string>): string {
  let html = String(files['index.html'] || '').trim();
  const css = String(files['styles.css'] || '').trim();
  const js = String(files['app.js'] || '').trim();
  const apiRoutesJs = String(files['api_routes.js'] || '').trim();

  if (!html) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>${css}</style></head><body class="bg-[#0b0c10] text-white"><div id="app"></div><script>${apiRoutesJs}\n${js}</script></body></html>`;
  }

  // Strip local link/script placeholders to ./styles.css and ./app.js so inline bundle is self-contained
  html = html.replace(/<link[^>]*href=["'](?:\.\/)?styles\.css["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]*src=["'](?:\.\/)?app\.js["'][^>]*>\s*<\/script>/gi, '');
  html = html.replace(/<script[^>]*src=["'](?:\.\/)?api_routes\.js["'][^>]*>\s*<\/script>/gi, '');

  const combinedJs = [apiRoutesJs, js].filter(Boolean).join('\n\n');

  if (css) {
    const styleTag = `<style>\n${css}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${styleTag}\n</head>`);
    } else {
      html = `${styleTag}\n${html}`;
    }
  }

  if (combinedJs) {
    // Escape </script inside JS string literals safely
    const safeJs = combinedJs.replace(/<\/script>/gi, '<\\/script>');
    const scriptTag = `<script>\n${safeJs}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      html = `${html}\n${scriptTag}`;
    }
  }

  return html;
}

export function validateStudioProject(
  files: Record<string, string>,
  compiledHtml: string
): StudioDiagnostics {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!compiledHtml.toLowerCase().includes('<html') || !compiledHtml.toLowerCase().includes('<body')) {
    errors.push('HTML bundle is missing root <html> or <body> structure.');
  }

  // Validate inline JS syntax cleanly via Node vm.Script (parses without executing!)
  const scriptMatches = Array.from(compiledHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  scriptMatches.forEach((match, idx) => {
    const attrs = match[1] || '';
    const body = (match[2] || '').trim();
    if (!body || /\bsrc\s*=/i.test(attrs)) return;
    if (/type\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)) return;
    const isModule = /type\s*=\s*["']module["']/i.test(attrs);
    if (isModule) return; // vm.Script parses classic scripts; skip ESM import syntax errors
    try {
      new vm.Script(body, { filename: `studio_script_${idx}.js` });
    } catch (err: any) {
      errors.push(`JavaScript Syntax Error (block #${idx + 1}): ${err?.message || 'Invalid JS syntax'}`);
    }
  });

  if (files['schema.json']) {
    try {
      JSON.parse(files['schema.json']);
    } catch (err: any) {
      warnings.push(`schema.json is not valid JSON: ${err?.message || 'Parse error'}`);
    }
  }

  if (compiledHtml.length < 250) {
    warnings.push('Compiled bundle size is unusually small (< 250 bytes).');
  }

  return {
    syntaxOk: errors.length === 0,
    errors,
    warnings,
    bundleBytes: Buffer.byteLength(compiledHtml, 'utf8'),
    fileCount: Object.keys(files).length,
    validatedAt: new Date().toISOString(),
  };
}

// =========================================================================
// Structured Output Parser (JSON Multi-File OR Single HTML Fallback)
// =========================================================================
function tryExtractJsonProject(rawText: string): {
  title?: string;
  description?: string;
  summary?: string;
  features?: string[];
  files?: Record<string, string>;
} | null {
  const cleaned = String(rawText || '').trim();
  if (!cleaned) return null;

  const candidates: string[] = [];
  const fencedJson = cleaned.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) candidates.push(fencedJson[1].trim());

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand);
      if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractHtmlDocument(raw: string): string {
  let cleaned = String(raw || '').trim();
  const fencedMatch = cleaned.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    cleaned = fencedMatch[1].trim();
  }
  const docIdx = cleaned.search(/<!DOCTYPE html>|<html/i);
  if (docIdx > 0) cleaned = cleaned.slice(docIdx).trim();
  const endHtmlIdx = cleaned.toLowerCase().lastIndexOf('</html>');
  if (endHtmlIdx > 0) {
    cleaned = cleaned.slice(0, endHtmlIdx + 7).trim();
  }
  return cleaned;
}

// =========================================================================
// Mode-Aware Prompts
// =========================================================================
function getModeGuidelines(mode: StudioBuildMode): string {
  switch (mode) {
    case 'Prototype mode':
      return `MODE DIRECTIVE — PROTOTYPE MODE:
- Build a multi-screen clickable interactive UX prototype with at least 3 switchable screens/views (e.g. Overview, Workspace, Detail/Settings) controlled cleanly via top/side state navigation.
- Include realistic state transitions, interactive modals, hover/focus polish, and zero dead buttons.
- Expose a subtle prototype state indicator or quick view-switcher so users can test every user journey end-to-end.`;

    case 'Fullstack mode':
      return `MODE DIRECTIVE — FULLSTACK MODE:
- Engineer a full-stack architecture using a client-side REST API router inside app.js (e.g. \`apiFetch(method, path, body)\`) backed by persistent \`localStorage\` storage + seed dataset.
- Include an interactive "API & Data Inspector" toggle/drawer inside the app so developers can view live CRUD payloads, latency, and JSON schema state.
- Ensure \`schema.json\`, \`api_routes.js\`, and \`architecture.md\` reflect the real data entities and endpoints.`;

    case 'Mobile mode':
      return `MODE DIRECTIVE — MOBILE APP MODE:
- Design strictly mobile-first (fits 375px–414px width seamlessly while still looking crisp centered on desktop).
- Include a sticky bottom navigation bar (3–4 tabs, >= 44px touch targets), top mobile app header, swipe/tap-friendly cards, and clean safe-area padding.`;

    default:
      return `MODE DIRECTIVE — DEFAULT PRODUCTION WEB APP:
- Build a complete, responsive, production-grade single-page web application with rich interactive UI, clean dark slate or crisp neutral contrast, real CRUD/interactions, and \`localStorage\` persistence.`;
  }
}

function formatAttachmentContext(attachments?: StudioAppAttachment[]): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const textParts = attachments
    .filter((a) => a.kind === 'text' && a.data)
    .map((a) => `--- ATTACHED FILE: ${a.name} (${a.mimeType}) ---\n${a.data.slice(0, 12000)}`);
  return textParts.length > 0 ? `\n\n[ATTACHED SPECIFICATIONS / FILES]\n${textParts.join('\n\n')}` : '';
}

function buildConfigArchitectureDirectives(config?: StudioProjectConfig): string {
  if (!config) return '';
  const cp = config.codingParams || DEFAULT_PROJECT_CONFIG.codingParams;
  const activeTools = (config.integrations || []).join(', ') || 'None';

  let categoryBlock = '';
  switch (config.category) {
    case 'browser_extension':
      categoryBlock = `TARGET CATEGORY — CHROME / EDGE / FIREFOX BROWSER EXTENSION (MANIFEST V3):
- Generate real Manifest V3 files inside \`files\`:
  * \`extension/manifest.json\`: Valid MV3 manifest (manifest_version: 3, permissions, action.default_popup, background.service_worker, content_scripts).
  * \`extension/popup.html\` & \`extension/popup.js\`: Complete working extension popup UI & chrome.storage logic.
  * \`extension/background.js\`: Service worker event listeners & alarms/rules.
  * \`extension/content.js\`: Clean DOM content script with zero global pollution.
- CRITICAL FOR LIVE PREVIEW: Also provide \`index.html\`, \`styles.css\`, and \`app.js\` implementing an interactive Browser Extension Popup & Tab Simulator so the user can test every toggle, rule, and permission live in the right preview canvas!`;
      break;

    case 'script_cli':
      categoryBlock = `TARGET CATEGORY — ${config.scriptLanguage.toUpperCase()} AUTOMATION SCRIPT / CLI TOOL:
- Generate production ${config.scriptLanguage} source files inside \`files\`:
  * Primary script file (e.g. \`scripts/main.${config.scriptLanguage === 'python' ? 'py' : config.scriptLanguage === 'rust' ? 'rs' : config.scriptLanguage === 'go' ? 'go' : config.scriptLanguage === 'bash' ? 'sh' : config.scriptLanguage === 'sql' ? 'sql' : 'ts'}\`) with strict argument parsing, structured logging, error handling, and help output.
  * Appropriate dependency manifest (\`requirements.txt\`, \`package.json\`, \`Cargo.toml\`, or \`go.mod\`) + \`README.md\` usage examples.
- CRITICAL FOR LIVE PREVIEW: Also provide \`index.html\`, \`styles.css\`, and \`app.js\` rendering a clean Interactive CLI Flag Builder, Sample Input Runner & Simulated Output Console so non-coders and engineers can test the script behavior visually right in the preview window!`;
      break;

    case 'api_service':
      categoryBlock = `TARGET CATEGORY — PRODUCTION REST / GRAPHQL API & MICROSERVICE (${config.backendRuntime}):
- Generate real backend service files inside \`files\`:
  * \`backend/server.${config.backendRuntime === 'python_fastapi' ? 'py' : config.backendRuntime === 'go_gin' ? 'go' : 'ts'}\`: Real routes, middleware, input validation, rate limiting, and error handler.
  * \`database/schema.sql\` (or Firestore schema), \`openapi.json\`, \`.env.example\`, and \`tests/api.test.js\`.
- CRITICAL FOR LIVE PREVIEW: Also provide \`index.html\`, \`styles.css\`, and \`app.js\` implementing a clean Interactive API Endpoint Explorer & Live Request Simulator where users can send CRUD payloads and inspect JSON responses!`;
      break;

    case 'saas':
    case 'micro_saas':
    case 'fullstack':
      categoryBlock = `TARGET CATEGORY — PRODUCTION ${config.category.toUpperCase()} PLATFORM:
- Generate a real multi-layer repository inside \`files\`:
  * Frontend UI (\`index.html\`, \`styles.css\`, \`app.js\`): Rich multi-view product workspace with real client-side state/CRUD, forms, search/filter, and persistence.
  * Backend API (\`backend/server.${config.backendRuntime === 'python_fastapi' ? 'py' : 'ts'}\`): Real Express/FastAPI endpoints matching every frontend resource (${config.authProvider !== 'none' ? `with ${config.authProvider} auth middleware` : 'with validation middleware'}).
  * Database Layer (\`${config.database === 'firestore' ? 'firestore.rules' : 'database/schema.sql'}\` + \`schema.json\`): Normalized schema & security rules.
  * Ops & Configs (\`.env.example\`, \`package.json\`, \`README.md\`${cp.includeUnitTests ? ', `tests/app.test.js`' : ''}).`;
      break;

    case 'mobile_pwa':
      categoryBlock = `TARGET CATEGORY — INSTALLABLE MOBILE-FIRST PWA:
- Mobile-first viewport layout (fits 375px cleanly + centered desktop shell) with >=44px touch targets and bottom tab navigation.
- Include \`manifest.json\` and \`sw.js\` (offline service worker cache) inside \`files\`.`;
      break;

    default:
      categoryBlock = `TARGET CATEGORY — ${config.category.toUpperCase()} (${config.frontendFramework}):
- Build a polished, production-ready web product with real interactive state, keyboard support, zero dead buttons, and clean modular structure.`;
  }

  return `
[SILICON VALLEY ENGINEERING CONFIGURATION]
- Category: ${config.category}
- Frontend Framework: ${config.frontendFramework}
- Backend Runtime: ${config.backendRuntime}
- Database Engine: ${config.database}
- Script Language: ${config.scriptLanguage}
- Auth Provider: ${config.authProvider}
- Payment / Billing: ${config.paymentProvider}
- 3rd-Party Integrations: ${activeTools}
- Target Deploy Platform: ${config.deployTarget}
- Coding Standards:
  * TypeScript Strictness: ${cp.strictTypeScript ? 'Strict' : 'Standard'}
  * Architecture: ${cp.architecturePattern}
  * Theme Mode: ${cp.themeMode}
  * Responsive Mobile-First: ${cp.responsiveMobileFirst ? 'Required' : 'Desktop-first'}
  * Security Hardening: ${cp.securityHardening ? 'Enforce XSS escaping, no eval(), env secrets only' : 'Standard'}
  * SEO Meta Tags: ${cp.includeSeoMeta ? 'Include title, description, OG meta' : 'Minimal'}
  * Unit Tests: ${cp.includeUnitTests ? 'Include tests/app.test.js' : 'Skip'}
${config.customDependencies?.length ? `- Required Packages: ${config.customDependencies.join(', ')}` : ''}

${categoryBlock}`;
}

export function buildStudioGeneratePrompt(opts: {
  prompt: string;
  mode: StudioBuildMode;
  attachments?: StudioAppAttachment[];
  projectConfig?: StudioProjectConfig;
}): string {
  const cfgBlock = buildConfigArchitectureDirectives(opts.projectConfig);
  return `You are the RaOne Senior Principal Full-Stack Software Engineer in RaOne Code Studio.
Build a complete, zero-placeholder, production-grade software solution for:
"${opts.prompt}"

${getModeGuidelines(opts.mode)}
${cfgBlock}
${formatAttachmentContext(opts.attachments)}

TECHNICAL & OUTPUT CONTRACT:
1. Return a clean JSON object (preferred — no markdown prose outside JSON) with multi-file architecture:
   {
     "title": "Short clean project title",
     "description": "1-sentence summary",
     "files": {
       "index.html": "<!DOCTYPE html>... complete runnable HTML preview with Tailwind CDN (<script src=\\"https://cdn.tailwindcss.com\\"></script>) & semantic DOM ...",
       "styles.css": "Custom CSS tokens & layout styles",
       "app.js": "Complete ES6+ interactive logic, event listeners & persistence",
       "api_routes.js": "Optional client-side REST API simulation bridge for preview",
       "backend/server.ts": "Optional real backend server source when backendRuntime != none",
       "database/schema.sql": "Optional SQL schema or firestore.rules when database requires it",
       "tests/app.test.js": "Optional unit tests when includeUnitTests is enabled",
       "schema.json": "{ ...valid JSON schema... }",
       "architecture.md": "# Architecture..."
     }
   }
   (If returning single-file HTML fallback, wrap cleanly in <!DOCTYPE html> with Tailwind CDN, Plus Jakarta Sans + JetBrains Mono Google Fonts, inline <style> and inline <script>.)
2. Use Chart.js (https://cdn.jsdelivr.net/npm/chart.js) if analytics/charts are requested, or Leaflet (https://unpkg.com/leaflet@1.9.4/dist/leaflet.js + leaflet.css) if maps are requested.
3. Every single button, form, modal, search, filter, and export action MUST have working JavaScript handlers — zero dead buttons or placeholder alerts.`;
}

export function buildStudioRefinePrompt(opts: {
  app: Partial<RichStudioApp>;
  refinementPrompt: string;
  mode: StudioBuildMode;
  selectedElementContext?: string;
  attachments?: StudioAppAttachment[];
  projectConfig?: StudioProjectConfig;
}): string {
  const existingFiles: Record<string, string> = opts.app.files || {};
  const extraFilesPreview = Object.entries(existingFiles)
    .filter(([k]) => k !== 'index.html' && k !== 'architecture.md')
    .slice(0, 6)
    .map(([k, v]) => `--- ${k} ---\n${String(v).slice(0, 4000)}`)
    .join('\n\n');
  const existingCode = opts.app.code || existingFiles['index.html'] || '';
  const elementHint = opts.selectedElementContext
    ? `\n\n[TARGETED UI ELEMENT SELECTED BY USER]\n${opts.selectedElementContext}\nApply the change specifically considering this selected element while keeping all existing functionality working.`
    : '';
  const cfgBlock = buildConfigArchitectureDirectives(opts.projectConfig || opts.app.projectConfig);

  return `You are refining an existing RaOne Code Studio software project (${opts.mode}).
${cfgBlock}

EXISTING COMPILED PREVIEW BUNDLE:
\`\`\`html
${existingCode.slice(0, 26000)}
\`\`\`
${extraFilesPreview ? `\nADDITIONAL PROJECT FILES:\n${extraFilesPreview}` : ''}
${elementHint}
${formatAttachmentContext(opts.attachments)}

USER REFACTORING DIRECTIVE:
"${opts.refinementPrompt}"

REQUIREMENTS:
1. Preserve all working features unless the user asked to remove or replace them.
2. Return the COMPLETE updated application in JSON multi-file format (\`{ "title", "description", "files": { "index.html", "styles.css", "app.js", ... } }\`) OR a complete updated \`<!DOCTYPE html>\` document.
3. Ensure zero syntax errors, zero missing DOM IDs, and clean working event handlers.`;
}

export function buildStudioAutoFixPrompt(opts: {
  app: Partial<RichStudioApp>;
  runtimeErrors: string[];
}): string {
  const existingCode = opts.app.code || opts.app.files?.['index.html'] || '';
  return `You are debugging and fixing runtime/syntax errors in an existing HTML/CSS/JS web application.

REPORTED RUNTIME / SYNTAX ERRORS:
${opts.runtimeErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

BROKEN APPLICATION CODE:
\`\`\`html
${existingCode.slice(0, 32000)}
\`\`\`

TASK:
Fix the exact root causes of every error above while preserving all existing UI and features.
Output ONLY the complete fixed \`<!DOCTYPE html>\` document (or JSON \`{ "files": { "index.html", "styles.css", "app.js" } }\`) with zero explanatory prose.`;
}

// =========================================================================
// Unified Multi-Provider AI Execution Engine (Streaming + Non-Streaming)
// =========================================================================
export interface ExecuteStudioAiOptions {
  providerChoice: StudioProviderChoice;
  requestedModel?: string;
  userPromptText: string;
  systemInstruction: string;
  attachments?: StudioAppAttachment[];
  byok: ByokKeyMap;
  geminiClient: GoogleGenAI | null;
  serverKeys: {
    groqApiKey: string;
    openAiApiKey: string;
    anthropicApiKey: string;
    deepSeekApiKey: string;
    cometApiKey: string;
    cometApiBaseUrl: string;
  };
  onDelta?: (delta: string, accumulated: string) => void;
  onStatus?: (providerLabel: string, modelLabel: string) => void;
}

export interface ExecuteStudioAiResult {
  rawText: string;
  providerUsed: string;
  modelUsed: string;
}

async function streamOpenAiCompatibleStudio(opts: {
  url: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
  model: string;
  systemInstruction: string;
  userPromptText: string;
  maxTokens?: number;
  onDelta?: (delta: string, acc: string) => void;
}): Promise<{ text: string; model: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.extraHeaders || {}),
  };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const resp = await fetch(opts.url, {
    method: 'POST',
    redirect: 'error',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemInstruction },
        { role: 'user', content: opts.userPromptText },
      ],
      temperature: 0.4,
      max_tokens: opts.maxTokens || 8192,
      stream: true,
    }),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 220)}`);
  }

  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content || '';
    if (text && opts.onDelta) opts.onDelta(text, text);
    return { text, model: json.model || opts.model };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let acc = '';
  let resolvedModel = opts.model;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.model) resolvedModel = evt.model;
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          acc += delta;
          opts.onDelta?.(delta, acc);
        }
      } catch {
        continue;
      }
    }
  }

  return { text: acc, model: resolvedModel };
}

export async function executeStudioAiPrompt(
  opts: ExecuteStudioAiOptions
): Promise<ExecuteStudioAiResult | null> {
  const pref = opts.providerChoice || 'auto';
  const order: Array<'gemini' | 'groq' | 'local' | 'openai' | 'deepseek' | 'anthropic' | 'comet'> =
    pref === 'auto'
      ? ['gemini', 'groq', 'local', 'openai', 'deepseek', 'anthropic', 'comet']
      : [
          pref,
          ...(
            ['gemini', 'groq', 'local', 'openai', 'deepseek', 'anthropic', 'comet'] as const
          ).filter((p) => p !== pref),
        ];

  const imageParts = (opts.attachments || [])
    .filter((a) => a.kind === 'image' && a.data)
    .map((a) => ({
      inlineData: {
        mimeType: a.mimeType || 'image/png',
        data: a.data.replace(/^data:[^;]+;base64,/, ''),
      },
    }));

  for (const provider of order) {
    if (provider === 'gemini' && opts.geminiClient) {
      const candidates = opts.requestedModel?.includes('argon')
        ? ['gemini-4-argon', 'gemini-4-hydrogen']
        : ['gemini-4-hydrogen', 'gemini-4-argon'];
      for (const modelName of candidates) {
        try {
          opts.onStatus?.('Google Gemini', modelName);
          const parts: any[] = [...imageParts, { text: opts.userPromptText }];
          const stream = await opts.geminiClient.models.generateContentStream({
            model: modelName,
            contents: [{ role: 'user', parts }],
            config: {
              systemInstruction: appendRuntimeMetadata(opts.systemInstruction, {
                provider: 'Google Gemini API',
                model: modelName,
                subsystem: 'RaOne Code Studio Engine',
              }),
            },
          });
          let acc = '';
          for await (const chunk of stream) {
            const delta = chunk.text || '';
            if (delta) {
              acc += delta;
              opts.onDelta?.(delta, acc);
            }
          }
          if (acc.trim().length > 80) {
            return { rawText: acc, providerUsed: 'gemini', modelUsed: modelName };
          }
        } catch (err: any) {
          console.warn(`Studio Gemini (${modelName}) notice:`, err?.message || err);
        }
      }
    }

    if (provider === 'groq') {
      const groqKey = opts.byok.groqApiKey || opts.serverKeys.groqApiKey;
      if (!groqKey) continue;
      try {
        const modelToUse = opts.requestedModel?.includes('llama')
          ? opts.requestedModel
          : 'raone-llama3-70b';
        opts.onStatus?.('Groq Cloud LPU', modelToUse);
        let acc = '';
        await streamGroqChatToSSE(
          groqKey,
          modelToUse,
          [
            { role: 'system', content: opts.systemInstruction },
            { role: 'user', content: opts.userPromptText },
          ],
          (evt) => {
            if (evt.type === 'chunk' && typeof evt.text === 'string') {
              acc += evt.text;
              opts.onDelta?.(evt.text, acc);
            }
          },
          Date.now(),
          true
        );
        if (acc.trim().length > 80) {
          return { rawText: acc, providerUsed: 'groq', modelUsed: modelToUse };
        }
      } catch (err: any) {
        console.warn('Studio Groq notice:', err?.message || err);
      }
    }

    if (provider === 'local') {
      const localCfg = getActiveLocalEndpointConfig(opts.byok);
      if (!localCfg.baseUrl) continue;
      try {
        opts.onStatus?.('Local llama.cpp', localCfg.modelId);
        let acc = '';
        await streamLocalLlmToSSE({
          baseUrl: localCfg.baseUrl,
          modelId: localCfg.modelId,
          apiKey: localCfg.apiKey,
          messages: [],
          prompt: opts.userPromptText,
          systemPrompt: opts.systemInstruction,
          sendEvent: (evt) => {
            if (evt.type === 'chunk' && typeof evt.text === 'string') {
              acc += evt.text;
              opts.onDelta?.(evt.text, acc);
            }
          },
          startTime: Date.now(),
        });
        if (acc.trim().length > 80) {
          return { rawText: acc, providerUsed: 'local', modelUsed: localCfg.modelId };
        }
      } catch (err: any) {
        console.warn('Studio Local llama.cpp notice:', err?.message || err);
      }
    }

    if (provider === 'openai') {
      const key = opts.byok.openAiApiKey || opts.serverKeys.openAiApiKey;
      if (!key) continue;
      try {
        opts.onStatus?.('OpenAI', 'gpt-4o');
        const out = await streamOpenAiCompatibleStudio({
          url: 'https://api.openai.com/v1/chat/completions',
          apiKey: key,
          model: 'gpt-4o',
          systemInstruction: opts.systemInstruction,
          userPromptText: opts.userPromptText,
          onDelta: opts.onDelta,
        });
        if (out.text.trim().length > 80) {
          return { rawText: out.text, providerUsed: 'openai', modelUsed: out.model };
        }
      } catch (err: any) {
        console.warn('Studio OpenAI notice:', err?.message || err);
      }
    }

    if (provider === 'deepseek') {
      const key = opts.byok.deepSeekApiKey || opts.serverKeys.deepSeekApiKey;
      if (!key) continue;
      try {
        opts.onStatus?.('DeepSeek', 'deepseek-chat');
        const out = await streamOpenAiCompatibleStudio({
          url: 'https://api.deepseek.com/chat/completions',
          apiKey: key,
          model: 'deepseek-chat',
          systemInstruction: opts.systemInstruction,
          userPromptText: opts.userPromptText,
          onDelta: opts.onDelta,
        });
        if (out.text.trim().length > 80) {
          return { rawText: out.text, providerUsed: 'deepseek', modelUsed: out.model };
        }
      } catch (err: any) {
        console.warn('Studio DeepSeek notice:', err?.message || err);
      }
    }

    if (provider === 'anthropic') {
      const key = opts.byok.anthropicApiKey || opts.serverKeys.anthropicApiKey;
      if (!key) continue;
      try {
        opts.onStatus?.('Anthropic', 'claude-3-5-sonnet-latest');
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 8192,
            system: opts.systemInstruction,
            messages: [{ role: 'user', content: opts.userPromptText }],
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          const text = json.content?.[0]?.text || '';
          if (text.trim().length > 80) {
            opts.onDelta?.(text, text);
            return {
              rawText: text,
              providerUsed: 'anthropic',
              modelUsed: 'claude-3-5-sonnet-latest',
            };
          }
        }
      } catch (err: any) {
        console.warn('Studio Anthropic notice:', err?.message || err);
      }
    }

    if (provider === 'comet') {
      const key = opts.byok.cometApiKey || opts.serverKeys.cometApiKey;
      const base = (opts.byok.cometApiBaseUrl || opts.serverKeys.cometApiBaseUrl || '').replace(/\/+$/, '');
      if (!key || !base) continue;
      try {
        const safe = await validateSafeHttpsEgress(base);
        if (!safe.ok) continue;
        opts.onStatus?.('CometAPI Gateway', 'gpt-4o');
        const out = await streamOpenAiCompatibleStudio({
          url: `${base}/chat/completions`,
          apiKey: key,
          model: 'gpt-4o',
          systemInstruction: opts.systemInstruction,
          userPromptText: opts.userPromptText,
          onDelta: opts.onDelta,
        });
        if (out.text.trim().length > 80) {
          return { rawText: out.text, providerUsed: 'comet', modelUsed: out.model };
        }
      } catch (err: any) {
        console.warn('Studio CometAPI notice:', err?.message || err);
      }
    }
  }

  return null;
}

export async function enhanceStudioPromptServer(opts: {
  rawPrompt: string;
  depth?: PromptEnhanceDepth;
  projectConfig?: StudioProjectConfig;
  providerChoice?: StudioProviderChoice;
  byok: ByokKeyMap;
  geminiClient: GoogleGenAI | null;
  serverKeys: ExecuteStudioAiOptions['serverKeys'];
}): Promise<{ enhancedPrompt: string; providerUsed: string }> {
  const cfg = opts.projectConfig || DEFAULT_PROJECT_CONFIG;
  const depth = opts.depth || 'fullstack';
  const raw = opts.rawPrompt.trim();

  const instruction = `You are a Principal Product Architect at a top Silicon Valley engineering studio.
Turn this brief user idea (even if just 1-3 words) into a crystal-clear, actionable software engineering build specification prompt.

USER IDEA: "${raw}"
ENHANCEMENT DEPTH: ${depth}
SELECTED STACK & TARGET:
- Category: ${cfg.category}
- Frontend: ${cfg.frontendFramework}
- Backend: ${cfg.backendRuntime}
- Database: ${cfg.database}
- Script Language: ${cfg.scriptLanguage}
- Auth: ${cfg.authProvider}
- Billing: ${cfg.paymentProvider}
- Integrations: ${(cfg.integrations || []).join(', ') || 'None'}
- Deploy Target: ${cfg.deployTarget}

RULES:
- Output ONLY the expanded prompt text directly (no markdown headings like "Enhanced Prompt:" or conversational intro).
- Make it concrete, detailed, and tailored specifically to the category and stack above:
  1. Core product goal & primary user workflow
  2. Exact screens / views / commands / extension panels or API endpoints needed
  3. Data entities, fields, validation rules & persistence behavior
  4. Design aesthetic, responsive layout, keyboard/empty states & real interactive controls (search, filter, CRUD, export)
  5. Security, error handling & production readiness.`;

  try {
    const out = await executeStudioAiPrompt({
      providerChoice: opts.providerChoice || 'auto',
      userPromptText: instruction,
      systemInstruction:
        'You rewrite brief app ideas into crisp, senior-engineer technical specification prompts. Output plain text only.',
      byok: opts.byok,
      geminiClient: opts.geminiClient,
      serverKeys: opts.serverKeys,
    });
    if (out?.rawText && out.rawText.trim().length > 40) {
      return { enhancedPrompt: out.rawText.trim(), providerUsed: `${out.providerUsed}/${out.modelUsed}` };
    }
  } catch (err) {
    console.warn('Prompt enhancer AI notice:', err);
  }

  // Deterministic Silicon Valley PRD fallback when no cloud/local AI provider responds
  const integrationsText = cfg.integrations?.length
    ? ` Integrate ${cfg.integrations.join(', ')}.`
    : '';
  const authText =
    cfg.authProvider !== 'none'
      ? ` Include secure ${cfg.authProvider} authentication with protected workspace routes and role validation.`
      : '';
  const fallback =
    depth === 'quick'
      ? `Build a production-ready ${cfg.category.replace('_', ' ')} for "${raw}" using ${cfg.frontendFramework} and ${cfg.database}.${integrationsText} Include full CRUD management, live search & filtering, responsive dark slate UI, empty states, and persistent storage.`
      : `Build a complete, Silicon Valley-grade ${cfg.category.replace('_', ' ')} for "${raw}" engineered with ${cfg.frontendFramework} (frontend), ${cfg.backendRuntime} (backend), and ${cfg.database} (persistence).${authText}${integrationsText}
Deliver:
1. Primary Workspace & Navigation: Clean structured layout with dashboard overview, interactive creation/editing modal, live search, multi-criteria filtering, and sortable tabular metrics.
2. Complete Data Lifecycle: Real CRUD actions with validation, optimistic feedback, import/export (JSON & CSV), and persistent storage.
3. Architecture & Quality: Modular code structure, XSS-safe rendering, error boundaries, responsive mobile layout, and keyboard shortcuts.
4. Verification & Readiness: Include schema definition, API contract routes, unit tests, and ${cfg.deployTarget} deployment configuration.`;

  return { enhancedPrompt: fallback, providerUsed: 'raone-architect-engine' };
}

// =========================================================================
// Project Assembly Helpers (New Build, Refinement, Auto-Fix, Persistence)
// =========================================================================
export function materializeProjectFromRawOutput(opts: {
  rawText: string;
  prompt: string;
  category: string;
  mode: StudioBuildMode;
  providerUsed: string;
  modelUsed: string;
  existingApp?: Partial<RichStudioApp>;
  isRefinement?: boolean;
  projectConfig?: StudioProjectConfig;
}): RichStudioApp | null {
  const now = new Date().toISOString();
  const parsedJson = tryExtractJsonProject(opts.rawText);
  const activeConfig = opts.projectConfig || opts.existingApp?.projectConfig || DEFAULT_PROJECT_CONFIG;

  let title =
    parsedJson?.title?.trim() ||
    opts.existingApp?.title ||
    opts.prompt.slice(0, 44) + (opts.prompt.length > 44 ? '...' : '');
  let description = parsedJson?.description?.trim() || opts.existingApp?.description || opts.prompt;

  let files: RichStudioApp['files'] | null = null;
  let compiledCode = '';

  if (parsedJson?.files && (parsedJson.files['index.html'] || parsedJson.files['app.js'] || Object.keys(parsedJson.files).length > 0)) {
    const rawFiles: Record<string, string> = { ...(opts.existingApp?.files || {}) };
    for (const [k, v] of Object.entries(parsedJson.files)) {
      if (typeof v === 'string') rawFiles[k] = v;
    }
    const candidateBundle = compileFilesIntoHtmlBundle(rawFiles);
    const decomposed = decomposeHtmlIntoFiles(
      candidateBundle,
      title,
      opts.prompt,
      opts.mode,
      rawFiles
    );
    files = decomposed;
    compiledCode = compileFilesIntoHtmlBundle(decomposed);
  } else {
    const htmlDoc = extractHtmlDocument(opts.rawText);
    if (!htmlDoc.includes('<!DOCTYPE html>') && !htmlDoc.includes('<html')) {
      return null;
    }
    files = decomposeHtmlIntoFiles(htmlDoc, title, opts.prompt, opts.mode, opts.existingApp?.files);
    compiledCode = compileFilesIntoHtmlBundle(files);
  }

  // Resolve dependencies & attach real package/env manifests if missing
  const depAnalysis = analyzeProjectDependencies(files, activeConfig);
  for (const [manifestName, manifestContent] of Object.entries(depAnalysis.generatedManifests)) {
    if (!files[manifestName]) {
      files[manifestName] = manifestContent;
    }
  }

  const diagnostics = validateStudioProject(files, compiledCode);
  const auditReport = runFullStudioAudit(files, compiledCode, activeConfig);
  const existingVersions = Array.isArray(opts.existingApp?.versions) ? opts.existingApp.versions : [];
  const nextVersionNum = existingVersions.length + 1;

  const newSnapshot: StudioVersionSnapshot = {
    version: nextVersionNum,
    prompt: opts.prompt,
    mode: opts.mode,
    providerUsed: opts.providerUsed,
    modelUsed: opts.modelUsed,
    createdAt: now,
    code: compiledCode,
    files,
  };

  const agentStep = {
    step: (opts.existingApp?.agentSteps?.length || 0) + 1,
    phase: opts.isRefinement ? `Iteration v${nextVersionNum}` : 'Multi-File Build',
    title: `${opts.isRefinement ? 'Refined' : 'Built'} via ${opts.providerUsed} (${opts.modelUsed})`,
    status: 'complete' as const,
    details: `${opts.mode} · ${activeConfig.category} · ${diagnostics.fileCount} files · Audit ${auditReport.score}/100 · Syntax: ${diagnostics.syntaxOk ? 'OK' : diagnostics.errors[0] || 'Warning'}`,
    timestamp: now,
  };

  return {
    id: opts.existingApp?.id || `app-${Date.now()}`,
    title,
    description,
    category: opts.existingApp?.category || activeConfig.category || opts.category || 'general',
    icon: opts.existingApp?.icon || 'sparkles',
    tag: opts.providerUsed === 'local' ? 'Local llama.cpp' : `${activeConfig.category}`,
    author: `RaOne Code Studio (${opts.modelUsed})`,
    mode: opts.mode,
    framework: `${activeConfig.frontendFramework}${activeConfig.backendRuntime !== 'none' ? ` + ${activeConfig.backendRuntime}` : ''}`,
    providerUsed: opts.providerUsed,
    modelUsed: opts.modelUsed,
    createdAt: opts.existingApp?.createdAt || now,
    updatedAt: now,
    code: compiledCode,
    files,
    projectConfig: activeConfig,
    auditReport,
    dependencies: depAnalysis.dependencies,
    envVariables: depAnalysis.envVariables,
    diagnostics,
    versions: [...existingVersions, newSnapshot].slice(-20),
    currentVersion: nextVersionNum,
    publishMeta: opts.existingApp?.publishMeta || { isPublished: false },
    turns: opts.existingApp?.turns || [],
    agentSteps: [...(opts.existingApp?.agentSteps || []), agentStep],
  };
}

export function fallbackSynthesizeStudioProject(opts: {
  prompt: string;
  category: string;
  mode: StudioBuildMode;
  existingApp?: Partial<RichStudioApp>;
  isRefinement?: boolean;
  projectConfig?: StudioProjectConfig;
}): RichStudioApp {
  const now = new Date().toISOString();
  const activeConfig = opts.projectConfig || opts.existingApp?.projectConfig || DEFAULT_PROJECT_CONFIG;
  let baseProj: SynthesizedProject;
  if (opts.isRefinement && opts.existingApp?.code) {
    baseProj = refineSynthesizedProject(
      {
        ...(opts.existingApp as SynthesizedProject),
        files: {
          'index.html': opts.existingApp.files?.['index.html'] || opts.existingApp.code,
          'app.js': opts.existingApp.files?.['app.js'] || '',
          'styles.css': opts.existingApp.files?.['styles.css'] || '',
          'architecture.md': opts.existingApp.files?.['architecture.md'] || '',
          'schema.json': opts.existingApp.files?.['schema.json'] || '{}',
        },
      },
      opts.prompt
    );
  } else {
    baseProj = synthesizeFullProject(opts.prompt, opts.category);
  }

  const extraScaffoldFiles: Record<string, string> = { ...(opts.existingApp?.files || {}), ...baseProj.files };

  if (
    activeConfig.backendRuntime === 'none' &&
    (activeConfig.category === 'browser_extension' || activeConfig.category === 'script_cli' || activeConfig.category === 'website')
  ) {
    delete extraScaffoldFiles['backend/server.ts'];
  }

  // Add category-tailored starter files so Extensions, Scripts, APIs & Fullstack projects always ship complete layer files
  if (activeConfig.category === 'browser_extension') {
    if (!extraScaffoldFiles['extension/manifest.json']) {
      extraScaffoldFiles['extension/manifest.json'] = JSON.stringify(
        {
          manifest_version: 3,
          name: baseProj.title,
          version: '1.0.0',
          description: baseProj.description,
          permissions: ['storage', 'activeTab'],
          action: { default_popup: 'popup.html' },
          background: { service_worker: 'background.js' },
        },
        null,
        2
      );
    }
    if (!extraScaffoldFiles['extension/background.js']) {
      extraScaffoldFiles['extension/background.js'] = `// Chrome MV3 Background Service Worker\nchrome.runtime.onInstalled.addListener(() => {\n  chrome.storage.local.set({ enabled: true, installedAt: Date.now() });\n});\n`;
    }
    if (!extraScaffoldFiles['extension/popup.html']) {
      extraScaffoldFiles['extension/popup.html'] = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${baseProj.title}</title></head><body><div id="popup-root"></div><script src="./popup.js"></script></body></html>\n`;
    }
    if (!extraScaffoldFiles['extension/popup.js']) {
      extraScaffoldFiles['extension/popup.js'] = `document.addEventListener('DOMContentLoaded', () => {\n  chrome.storage?.local.get(['enabled'], (res) => {\n    console.log('Extension state:', res);\n  });\n});\n`;
    }
  }

  if (activeConfig.category === 'script_cli') {
    const lang = activeConfig.scriptLanguage || 'python';
    if (lang === 'python' && !extraScaffoldFiles['scripts/main.py']) {
      extraScaffoldFiles['scripts/main.py'] = `#!/usr/bin/env python3
"""${baseProj.title} — Automated CLI Utility"""
import argparse
import json
from pathlib import Path

def run(target_path: str, verbose: bool = False) -> dict:
    path = Path(target_path)
    result = {"task": "${baseProj.title}", "target": str(path), "exists": path.exists()}
    if verbose:
        print(json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="${baseProj.description.replace(/"/g, "'")}")
    parser.add_argument("--input", default=".", help="Input path or resource")
    parser.add_argument("--verbose", action="store_true", help="Enable structured JSON output")
    args = parser.parse_args()
    print(json.dumps(run(args.input, args.verbose), indent=2))
`;
    } else if ((lang === 'typescript' || lang === 'javascript') && !extraScaffoldFiles[`scripts/main.${lang === 'typescript' ? 'ts' : 'mjs'}`]) {
      const ext = lang === 'typescript' ? 'ts' : 'mjs';
      extraScaffoldFiles[`scripts/main.${ext}`] = `#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const target = args[0] || '.';
const summary = {
  utility: '${baseProj.title.replace(/'/g, '')}',
  target,
  exists: fs.existsSync(target),
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(summary, null, 2));
`;
    } else if (lang === 'go' && !extraScaffoldFiles['scripts/main.go']) {
      extraScaffoldFiles['scripts/main.go'] = `package main

import (
\t"encoding/json"
\t"flag"
\t"fmt"
)

func main() {
\tinput := flag.String("input", ".", "Input target")
\tflag.Parse()
\tout, _ := json.MarshalIndent(map[string]string{"service": "${baseProj.title.replace(/"/g, "'")}", "input": *input}, "", "  ")
\tfmt.Println(string(out))
}
`;
    } else if (lang === 'rust' && !extraScaffoldFiles['scripts/main.rs']) {
      extraScaffoldFiles['scripts/main.rs'] = `use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    let target = args.get(1).map(String::as_str).unwrap_or(".");
    println!("{{\"utility\": \"${baseProj.title.replace(/"/g, "'")}\", \"target\": \"{}\"}}", target);
}
`;
    } else if (lang === 'bash' && !extraScaffoldFiles['scripts/run.sh']) {
      extraScaffoldFiles['scripts/run.sh'] = `#!/usr/bin/env bash
set -euo pipefail
TARGET="\${1:-.}"
echo "Running ${baseProj.title.replace(/"/g, "'")} on \${TARGET}"
ls -la "\${TARGET}"
`;
    } else if (lang === 'sql' && !extraScaffoldFiles['scripts/queries.sql']) {
      extraScaffoldFiles['scripts/queries.sql'] = `-- ${baseProj.title}
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

SELECT status, COUNT(*) AS total FROM records GROUP BY status;
`;
    }
  }

  if (
    (activeConfig.backendRuntime !== 'none' || activeConfig.category === 'saas' || activeConfig.category === 'fullstack' || activeConfig.category === 'api_service') &&
    !extraScaffoldFiles['backend/server.ts']
  ) {
    extraScaffoldFiles['backend/server.ts'] = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const records: Array<{ id: string; title: string; createdAt: string }> = [];

app.get('/api/health', (_req, res) => res.json({ ok: true, service: '${baseProj.title}' }));
app.get('/api/records', (_req, res) => res.json({ items: records }));
app.post('/api/records', (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const item = { id: 'rec_' + Date.now(), title, createdAt: new Date().toISOString() };
  records.unshift(item);
  res.status(201).json({ item });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log('API listening on', port));
`;
  }

  if (activeConfig.codingParams?.includeUnitTests && !extraScaffoldFiles['tests/app.test.js']) {
    extraScaffoldFiles['tests/app.test.js'] = `import test from 'node:test';
import assert from 'node:assert/strict';

test('${baseProj.title} smoke validation', () => {
  assert.equal(typeof '${baseProj.title}', 'string');
  assert.ok('${baseProj.title}'.length > 0);
});
`;
  }

  const files = decomposeHtmlIntoFiles(
    baseProj.code,
    baseProj.title,
    opts.prompt,
    opts.mode,
    extraScaffoldFiles
  );
  const depAnalysis = analyzeProjectDependencies(files, activeConfig);
  for (const [k, v] of Object.entries(depAnalysis.generatedManifests)) {
    if (!files[k]) files[k] = v;
  }

  const compiledCode = compileFilesIntoHtmlBundle(files);
  const diagnostics = validateStudioProject(files, compiledCode);
  const auditReport = runFullStudioAudit(files, compiledCode, activeConfig);
  const existingVersions = Array.isArray(opts.existingApp?.versions) ? opts.existingApp.versions : [];
  const nextVersionNum = existingVersions.length + 1;

  return {
    ...baseProj,
    id: opts.existingApp?.id || baseProj.id,
    mode: opts.mode,
    framework: `${activeConfig.frontendFramework}${activeConfig.backendRuntime !== 'none' ? ` + ${activeConfig.backendRuntime}` : ''}`,
    providerUsed: 'synthesizer',
    modelUsed: 'raone-deterministic-swe',
    code: compiledCode,
    files,
    projectConfig: activeConfig,
    auditReport,
    dependencies: depAnalysis.dependencies,
    envVariables: depAnalysis.envVariables,
    diagnostics,
    versions: [
      ...existingVersions,
      {
        version: nextVersionNum,
        prompt: opts.prompt,
        mode: opts.mode,
        providerUsed: 'synthesizer',
        modelUsed: 'raone-deterministic-swe',
        createdAt: now,
        code: compiledCode,
        files,
      },
    ].slice(-20),
    currentVersion: nextVersionNum,
    publishMeta: opts.existingApp?.publishMeta || { isPublished: false },
    turns: opts.existingApp?.turns || [],
  };
}
