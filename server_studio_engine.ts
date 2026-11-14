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
    'index.html': cleanIndexHtml || rawHtml,
    'styles.css': extractedCss,
    'app.js': extractedJs,
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

export function buildStudioGeneratePrompt(opts: {
  prompt: string;
  mode: StudioBuildMode;
  attachments?: StudioAppAttachment[];
}): string {
  return `You are the RaOne Senior Principal Full-Stack Software Engineer in RaOne Code Studio.
Build a complete, zero-placeholder, interactive web application for:
"${opts.prompt}"

${getModeGuidelines(opts.mode)}
${formatAttachmentContext(opts.attachments)}

TECHNICAL & OUTPUT CONTRACT:
1. Return EITHER a clean JSON object OR a single self-contained HTML5 document.
   - Preferred JSON format (no prose outside JSON):
   {
     "title": "Short clean app title",
     "description": "1-sentence summary",
     "files": {
       "index.html": "<!DOCTYPE html>... complete HTML with Tailwind CDN & semantic DOM (leave CSS in styles.css or <style>, JS in app.js or <script>) ...",
       "styles.css": "Custom CSS tokens & animations",
       "app.js": "Complete ES6+ interactive logic, event listeners & localStorage persistence",
       "api_routes.js": "Optional simulated API routes for Fullstack mode",
       "schema.json": "{ ...valid JSON schema... }",
       "architecture.md": "# Architecture..."
     }
   }
   - OR output a complete single <!DOCTYPE html> document with Tailwind CSS (https://cdn.tailwindcss.com), Plus Jakarta Sans + JetBrains Mono Google Fonts, inline <style> and inline <script>.
2. Use Chart.js (https://cdn.jsdelivr.net/npm/chart.js) if analytics/charts are requested, or Leaflet (https://unpkg.com/leaflet@1.9.4/dist/leaflet.js + leaflet.css) if maps are requested.
3. Every single button, form, modal, search, filter, and export action MUST have working JavaScript handlers — zero dead buttons or placeholder alerts.`;
}

export function buildStudioRefinePrompt(opts: {
  app: Partial<RichStudioApp>;
  refinementPrompt: string;
  mode: StudioBuildMode;
  selectedElementContext?: string;
  attachments?: StudioAppAttachment[];
}): string {
  const existingFiles: Record<string, string> = opts.app.files || {};
  const existingCode = opts.app.code || existingFiles['index.html'] || '';
  const elementHint = opts.selectedElementContext
    ? `\n\n[TARGETED UI ELEMENT SELECTED BY USER]\n${opts.selectedElementContext}\nApply the change specifically considering this selected element while keeping all existing functionality working.`
    : '';

  return `You are refining an existing RaOne Code Studio web application (${opts.mode}).

EXISTING APPLICATION CODE:
\`\`\`html
${existingCode.slice(0, 32000)}
\`\`\`
${elementHint}
${formatAttachmentContext(opts.attachments)}

USER REFACTORING DIRECTIVE:
"${opts.refinementPrompt}"

REQUIREMENTS:
1. Preserve all working features unless the user asked to remove or replace them.
2. Return the COMPLETE updated application either in the same JSON multi-file format (\`{ "title", "description", "files": { "index.html", "styles.css", "app.js", ... } }\`) OR a complete updated \`<!DOCTYPE html>\` document.
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
        ? ['gemini-4-argon', 'gemini-4-hydrogen', 'gemini-2.5-flash']
        : ['gemini-4-hydrogen', 'gemini-4-argon', 'gemini-2.5-flash'];
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
}): RichStudioApp | null {
  const now = new Date().toISOString();
  const parsedJson = tryExtractJsonProject(opts.rawText);

  let title =
    parsedJson?.title?.trim() ||
    opts.existingApp?.title ||
    opts.prompt.slice(0, 44) + (opts.prompt.length > 44 ? '...' : '');
  let description = parsedJson?.description?.trim() || opts.existingApp?.description || opts.prompt;

  let files: RichStudioApp['files'] | null = null;
  let compiledCode = '';

  if (parsedJson?.files && (parsedJson.files['index.html'] || parsedJson.files['app.js'])) {
    const rawFiles: Record<string, string> = {};
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

  const diagnostics = validateStudioProject(files, compiledCode);
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
    details: `${opts.mode} · ${diagnostics.fileCount} files · ${diagnostics.bundleBytes} bytes · Syntax: ${diagnostics.syntaxOk ? 'OK' : diagnostics.errors[0] || 'Warning'}`,
    timestamp: now,
  };

  return {
    id: opts.existingApp?.id || `app-${Date.now()}`,
    title,
    description,
    category: opts.existingApp?.category || opts.category || 'general',
    icon: opts.existingApp?.icon || 'sparkles',
    tag: opts.providerUsed === 'local' ? 'Local llama.cpp' : `${opts.mode}`,
    author: `RaOne Code Studio (${opts.modelUsed})`,
    mode: opts.mode,
    framework: opts.mode === 'Fullstack mode' ? 'HTML5 + Tailwind + REST Bridge' : 'HTML5 + Tailwind + ES6',
    providerUsed: opts.providerUsed,
    modelUsed: opts.modelUsed,
    createdAt: opts.existingApp?.createdAt || now,
    updatedAt: now,
    code: compiledCode,
    files,
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
}): RichStudioApp {
  const now = new Date().toISOString();
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

  const files = decomposeHtmlIntoFiles(
    baseProj.code,
    baseProj.title,
    opts.prompt,
    opts.mode,
    baseProj.files
  );
  const compiledCode = compileFilesIntoHtmlBundle(files);
  const diagnostics = validateStudioProject(files, compiledCode);
  const existingVersions = Array.isArray(opts.existingApp?.versions) ? opts.existingApp.versions : [];
  const nextVersionNum = existingVersions.length + 1;

  return {
    ...baseProj,
    id: opts.existingApp?.id || baseProj.id,
    mode: opts.mode,
    framework: opts.mode === 'Fullstack mode' ? 'HTML5 + Tailwind + REST Bridge' : 'HTML5 + Tailwind + ES6',
    providerUsed: 'synthesizer',
    modelUsed: 'raone-deterministic-swe',
    code: compiledCode,
    files,
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
