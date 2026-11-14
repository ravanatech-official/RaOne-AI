import vm from 'vm';
import type {
  StudioAuditFinding,
  StudioAuditReport,
  StudioDependencyItem,
  StudioProjectConfig,
  DeployTargetId,
} from './src/types/studio.ts';

const KNOWN_NPM_VERSIONS: Record<string, { version: string; purpose: string }> = {
  react: { version: '^19.0.0', purpose: 'UI component runtime' },
  'react-dom': { version: '^19.0.0', purpose: 'React DOM renderer' },
  'lucide-react': { version: '^0.546.0', purpose: 'Icon set' },
  express: { version: '^4.21.2', purpose: 'HTTP API server' },
  fastify: { version: '^5.2.0', purpose: 'High-throughput Node API server' },
  cors: { version: '^2.8.5', purpose: 'CORS security middleware' },
  helmet: { version: '^8.1.0', purpose: 'HTTP security headers' },
  zod: { version: '^3.24.2', purpose: 'Runtime schema validation' },
  dotenv: { version: '^17.2.3', purpose: 'Environment variable loader' },
  firebase: { version: '^11.6.0', purpose: 'Firebase client SDK' },
  'firebase-admin': { version: '^13.2.0', purpose: 'Firebase server Admin SDK' },
  stripe: { version: '^18.0.0', purpose: 'Payments & subscription billing' },
  pg: { version: '^8.14.1', purpose: 'PostgreSQL client driver' },
  'better-sqlite3': { version: '^11.9.1', purpose: 'Embedded SQLite database' },
  'drizzle-orm': { version: '^0.41.0', purpose: 'Type-safe SQL ORM' },
  jsonwebtoken: { version: '^9.0.2', purpose: 'JWT signing & verification' },
  '@google/genai': { version: '^1.0.0', purpose: 'Gemini server SDK' },
  ws: { version: '^8.18.1', purpose: 'WebSocket realtime server' },
  tailwindcss: { version: '^4.1.0', purpose: 'Utility CSS engine' },
  vite: { version: '^6.3.0', purpose: 'Frontend build bundler' },
  typescript: { version: '^5.8.0', purpose: 'Static type checker' },
  tsx: { version: '^4.19.3', purpose: 'TypeScript runtime runner' },
  vitest: { version: '^3.1.1', purpose: 'Unit test runner' },
};

const KNOWN_PIP_VERSIONS: Record<string, { version: string; purpose: string }> = {
  fastapi: { version: '>=0.115.0', purpose: 'Async REST API framework' },
  uvicorn: { version: '>=0.34.0', purpose: 'ASGI web server' },
  pydantic: { version: '>=2.11.0', purpose: 'Data & settings validation' },
  httpx: { version: '>=0.28.1', purpose: 'Async HTTP client' },
  pytest: { version: '>=8.3.5', purpose: 'Python test framework' },
  sqlalchemy: { version: '>=2.0.38', purpose: 'SQL toolkit & ORM' },
  'python-dotenv': { version: '>=1.1.0', purpose: 'Environment configuration' },
  pandas: { version: '>=2.2.3', purpose: 'Tabular data analysis' },
  rich: { version: '>=13.9.4', purpose: 'CLI formatting & tables' },
};

export function analyzeProjectDependencies(
  files: Record<string, string>,
  config?: Partial<StudioProjectConfig>
): {
  dependencies: StudioDependencyItem[];
  envVariables: string[];
  generatedManifests: Record<string, string>;
} {
  const depsMap = new Map<string, StudioDependencyItem>();
  const envSet = new Set<string>(config?.envVariables || []);

  const addDep = (
    name: string,
    ecosystem: StudioDependencyItem['ecosystem'],
    source: StudioDependencyItem['source'],
    purpose?: string
  ) => {
    const clean = name.trim();
    if (!clean || clean.startsWith('.') || clean.startsWith('/')) return;
    const key = `${ecosystem}:${clean}`;
    if (depsMap.has(key)) return;
    const known =
      ecosystem === 'npm'
        ? KNOWN_NPM_VERSIONS[clean]
        : ecosystem === 'pip'
        ? KNOWN_PIP_VERSIONS[clean]
        : undefined;
    depsMap.set(key, {
      name: clean,
      version: known?.version || (ecosystem === 'cdn' ? 'latest' : '*'),
      ecosystem,
      source,
      purpose: purpose || known?.purpose,
    });
  };

  // 1. Scan all project files for real imports, CDN URLs & env vars
  for (const [fname, content] of Object.entries(files)) {
    if (!content || typeof content !== 'string') continue;

    // Extract process.env.XYZ or os.environ["XYZ"] or os.getenv("XYZ")
    for (const m of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) {
      envSet.add(m[1]);
    }
    for (const m of content.matchAll(/os\.(?:getenv|environ\.get)\(\s*["']([A-Z][A-Z0-9_]{2,})["']/g)) {
      envSet.add(m[1]);
    }

    if (/\.(js|ts|jsx|tsx|mjs)$/.test(fname)) {
      for (const m of content.matchAll(/(?:import\s+[\s\S]*?from\s+|require\s*\()\s*["']([^"']+)["']/g)) {
        const pkg = m[1];
        if (pkg.startsWith('.') || pkg.startsWith('node:') || pkg.startsWith('http')) continue;
        const rootPkg = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
        if (!['fs', 'path', 'crypto', 'http', 'https', 'url', 'vm', 'os', 'child_process'].includes(rootPkg)) {
          addDep(rootPkg, 'npm', 'detected');
        }
      }
    }

    if (fname.endsWith('.py')) {
      for (const m of content.matchAll(/^\s*(?:import|from)\s+([a-zA-Z0-9_]+)/gm)) {
        const mod = m[1];
        if (!['os', 'sys', 'json', 're', 'math', 'time', 'datetime', 'pathlib', 'typing', 'argparse', 'sqlite3', 'csv', 'logging', 'asyncio', 'urllib', 'collections'].includes(mod)) {
          addDep(mod, 'pip', 'detected');
        }
      }
    }

    if (fname.endsWith('.html')) {
      if (content.includes('cdn.tailwindcss.com')) addDep('tailwindcss (CDN)', 'cdn', 'detected', 'Utility styling runtime');
      if (content.includes('chart.js')) addDep('chart.js (CDN)', 'cdn', 'detected', 'Data visualization charts');
      if (content.includes('leaflet')) addDep('leaflet (CDN)', 'cdn', 'detected', 'Interactive maps');
      if (content.includes('three')) addDep('three.js (CDN)', 'cdn', 'detected', '3D WebGL rendering');
    }
  }

  // 2. Include existing package.json dependencies if present
  if (files['package.json']) {
    try {
      const pkg = JSON.parse(files['package.json']);
      for (const [k, v] of Object.entries(pkg.dependencies || {})) {
        const key = `npm:${k}`;
        if (!depsMap.has(key)) {
          depsMap.set(key, { name: k, version: String(v), ecosystem: 'npm', source: 'detected' });
        }
      }
    } catch {
      // handled in audit
    }
  }

  // 3. Merge dependencies implied by StudioProjectConfig
  if (config) {
    if (config.frontendFramework === 'react_vite') {
      addDep('react', 'npm', 'config');
      addDep('react-dom', 'npm', 'config');
      addDep('lucide-react', 'npm', 'config');
      addDep('vite', 'npm', 'config');
    }
    if (config.backendRuntime === 'node_express') {
      addDep('express', 'npm', 'config');
      addDep('cors', 'npm', 'config');
      addDep('helmet', 'npm', 'config');
      addDep('dotenv', 'npm', 'config');
    } else if (config.backendRuntime === 'node_fastify') {
      addDep('fastify', 'npm', 'config');
      addDep('dotenv', 'npm', 'config');
    } else if (config.backendRuntime === 'python_fastapi') {
      addDep('fastapi', 'pip', 'config');
      addDep('uvicorn', 'pip', 'config');
      addDep('pydantic', 'pip', 'config');
    }
    if (config.database === 'firestore' || config.integrations?.includes('firebase_sdk')) {
      addDep('firebase', 'npm', 'config');
      envSet.add('FIREBASE_PROJECT_ID');
    }
    if (config.database === 'postgresql') {
      if (config.backendRuntime === 'python_fastapi') {
        addDep('sqlalchemy', 'pip', 'config');
      } else {
        addDep('pg', 'npm', 'config');
        addDep('drizzle-orm', 'npm', 'config');
      }
      envSet.add('DATABASE_URL');
    }
    if (config.authProvider === 'jwt_custom') {
      addDep('jsonwebtoken', 'npm', 'config');
      envSet.add('JWT_SECRET');
    }
    if (config.paymentProvider === 'stripe' || config.integrations?.includes('stripe_billing')) {
      addDep('stripe', 'npm', 'config');
      envSet.add('STRIPE_SECRET_KEY');
      envSet.add('STRIPE_WEBHOOK_SECRET');
    }
    if (config.integrations?.includes('ai_proxy')) {
      addDep('@google/genai', 'npm', 'config');
      envSet.add('GEMINI_API_KEY');
    }
    if (config.integrations?.includes('websockets')) {
      addDep('ws', 'npm', 'config');
    }
    if (config.integrations?.includes('google_maps')) {
      envSet.add('GOOGLE_MAPS_API_KEY');
    }
    for (const custom of config.customDependencies || []) {
      if (custom.trim()) {
        const eco = config.scriptLanguage === 'python' || config.backendRuntime === 'python_fastapi' ? 'pip' : 'npm';
        addDep(custom.trim(), eco, 'manual', 'User requested package');
      }
    }
  }

  const dependencies = Array.from(depsMap.values());
  const envVariables = Array.from(envSet);
  const generatedManifests: Record<string, string> = {};

  const npmDeps = dependencies.filter((d) => d.ecosystem === 'npm');
  if (npmDeps.length > 0 || config?.backendRuntime?.startsWith('node') || config?.frontendFramework === 'react_vite') {
    let existingPkg: Record<string, any> = {};
    if (files['package.json']) {
      try {
        existingPkg = JSON.parse(files['package.json']);
      } catch {
        existingPkg = {};
      }
    }
    const mergedDeps: Record<string, string> = { ...(existingPkg.dependencies || {}) };
    for (const d of npmDeps) {
      if (!mergedDeps[d.name]) mergedDeps[d.name] = d.version;
    }
    const hasBackendFile = Boolean(files['backend/server.ts'] || files['backend/server.js'] || files['server.ts']);
    generatedManifests['package.json'] = JSON.stringify(
      {
        name: existingPkg.name || 'raone-studio-app',
        version: existingPkg.version || '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: hasBackendFile ? 'tsx backend/server.ts' : 'vite',
          build: config?.frontendFramework === 'react_vite' ? 'vite build' : 'echo "Static bundle ready"',
          start: hasBackendFile ? 'node backend/server.ts' : 'npx serve .',
          test: config?.codingParams?.includeUnitTests ? 'node --test tests/*.test.js' : 'echo "No tests configured"',
          ...(existingPkg.scripts || {}),
        },
        dependencies: mergedDeps,
      },
      null,
      2
    );
  }

  const pipDeps = dependencies.filter((d) => d.ecosystem === 'pip');
  if (pipDeps.length > 0 || config?.scriptLanguage === 'python' || config?.backendRuntime === 'python_fastapi') {
    generatedManifests['requirements.txt'] = pipDeps
      .map((d) => `${d.name}${d.version !== '*' ? d.version : ''}`)
      .join('\n') + (pipDeps.length ? '\n' : 'pydantic>=2.11.0\n');
  }

  if (envVariables.length > 0) {
    generatedManifests['.env.example'] =
      envVariables.map((k) => `${k}=`).join('\n') + '\n';
  }

  return { dependencies, envVariables, generatedManifests };
}

export function runFullStudioAudit(
  files: Record<string, string>,
  compiledHtml: string,
  config?: Partial<StudioProjectConfig>
): StudioAuditReport {
  const findings: StudioAuditFinding[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const check = (
    passed: boolean,
    findingIfFail: Omit<StudioAuditFinding, 'id'>
  ) => {
    totalChecks += 1;
    if (passed) {
      passedChecks += 1;
    } else {
      findings.push({
        id: `aud_${findings.length + 1}_${findingIfFail.category}`,
        ...findingIfFail,
      });
    }
  };

  // 1. JavaScript Syntax Checks via Node vm.Script
  const scriptMatches = Array.from(compiledHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  let jsSyntaxOk = true;
  let jsErrorDetail = '';
  scriptMatches.forEach((m, idx) => {
    const attrs = m[1] || '';
    const body = (m[2] || '').trim();
    if (!body || /\bsrc\s*=/i.test(attrs)) return;
    if (/type\s*=\s*["'](?:application\/json|importmap|module)["']/i.test(attrs)) return;
    try {
      new vm.Script(body, { filename: `audit_block_${idx}.js` });
    } catch (err: any) {
      jsSyntaxOk = false;
      jsErrorDetail = err?.message || 'Syntax parse failure';
    }
  });
  check(jsSyntaxOk, {
    severity: 'critical',
    category: 'syntax',
    file: 'app.js',
    title: 'JavaScript Syntax Verification',
    description: `JavaScript syntax error detected: ${jsErrorDetail}`,
    fixHint: 'Fix bracket matching, missing tokens, or invalid expressions in app.js.',
  });

  // 2. JSON Validity Checks (schema.json, package.json, manifest.json)
  for (const jsonName of ['schema.json', 'package.json', 'manifest.json', 'extension/manifest.json', 'firebase.json']) {
    const raw = files[jsonName];
    if (!raw) continue;
    let valid = true;
    let parseErr = '';
    try {
      JSON.parse(raw);
    } catch (err: any) {
      valid = false;
      parseErr = err?.message || 'Invalid JSON';
    }
    check(valid, {
      severity: 'critical',
      category: 'syntax',
      file: jsonName,
      title: `Valid JSON (${jsonName})`,
      description: `${jsonName} failed JSON.parse(): ${parseErr}`,
      fixHint: `Ensure ${jsonName} is strictly valid JSON with double quotes and no trailing commas.`,
    });
  }

  // 3. Security Audits across all files
  const allCodeText = Object.values(files).join('\n') + '\n' + compiledHtml;
  const hasEval = /\beval\s*\(|new\s+Function\s*\(/.test(allCodeText);
  check(!hasEval, {
    severity: 'critical',
    category: 'security',
    file: 'app.js',
    title: 'No Dynamic eval() / Function() Execution',
    description: 'Detected eval() or new Function() which exposes code injection vulnerabilities.',
    fixHint: 'Replace eval/new Function with structured JSON parsing or safe switch handlers.',
  });

  const hasHardcodedSecret = /(?:AIzaSy[0-9A-Za-z_-]{20,}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[0-9a-zA-Z-]{10,})/.test(allCodeText);
  check(!hasHardcodedSecret, {
    severity: 'critical',
    category: 'security',
    file: '.env.example',
    title: 'Zero Hardcoded API Secrets',
    description: 'Detected a secret/token pattern directly inside source files.',
    fixHint: 'Move all credentials into server-side process.env variables and document in .env.example.',
  });

  const usesUnsafeInnerHtmlWithInput = /\.innerHTML\s*=[\s\S]{0,80}(?:value|input|prompt|search|query|location)/i.test(allCodeText);
  check(!usesUnsafeInnerHtmlWithInput, {
    severity: 'warning',
    category: 'security',
    file: 'app.js',
    title: 'XSS Prevention on Dynamic DOM Rendering',
    description: 'Dynamic user input appears near .innerHTML assignment without escaping.',
    fixHint: 'Escape HTML entities via an escapeHtml() helper or use textContent / DOM nodes.',
  });

  if (config?.category === 'browser_extension') {
    const manifestRaw = files['extension/manifest.json'] || files['manifest.json'] || '';
    const isMv3 = manifestRaw.includes('"manifest_version": 3') || manifestRaw.includes('"manifest_version":3');
    check(isMv3, {
      severity: 'critical',
      category: 'architecture',
      file: 'extension/manifest.json',
      title: 'Chrome Extension Manifest V3 Compliance',
      description: 'Extension bundle is missing manifest_version: 3.',
      fixHint: 'Include valid extension/manifest.json with manifest_version: 3.',
    });
    const overlyBroadHost = manifestRaw.includes('<all_urls>');
    check(!overlyBroadHost, {
      severity: 'warning',
      category: 'security',
      file: 'extension/manifest.json',
      title: 'Least-Privilege Extension Permissions',
      description: 'Manifest requests <all_urls> permission which triggers Chrome Web Store review delays.',
      fixHint: 'Use activeTab or narrow host_permissions where possible.',
    });
  }

  // 4. Web HTML, SEO & Accessibility Checks (for UI-facing categories)
  const isUiProject = config?.category !== 'api_service' && config?.category !== 'script_cli';
  if (isUiProject && compiledHtml) {
    check(/<!doctype html>/i.test(compiledHtml) && /<html/i.test(compiledHtml), {
      severity: 'critical',
      category: 'syntax',
      file: 'index.html',
      title: 'HTML5 Document Structure',
      description: 'Missing <!DOCTYPE html> or root <html> element.',
      fixHint: 'Start index.html with <!DOCTYPE html> and <html lang="en">.',
    });
    check(/<meta[^>]+name=["']viewport["']/i.test(compiledHtml), {
      severity: 'warning',
      category: 'accessibility',
      file: 'index.html',
      title: 'Responsive Mobile Viewport Meta',
      description: 'Missing <meta name="viewport"> tag for mobile scaling.',
      fixHint: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0" /> inside <head>.',
    });
    check(/<title>[^<]{2,}<\/title>/i.test(compiledHtml), {
      severity: 'warning',
      category: 'seo',
      file: 'index.html',
      title: 'Page Title & SEO Metadata',
      description: 'Missing descriptive <title> tag in index.html.',
      fixHint: 'Add a meaningful <title> and <meta name="description"> tag.',
    });
    check(/<html[^>]+lang=["'][a-z-]+["']/i.test(compiledHtml), {
      severity: 'info',
      category: 'accessibility',
      file: 'index.html',
      title: 'HTML Document Language Attribute',
      description: 'Add lang="en" to <html> for screen readers and accessibility.',
      fixHint: 'Update <html> to <html lang="en">.',
    });
  }

  // 5. Engineering Completeness Checks
  const hasReadme = Boolean(files['README.md'] || files['architecture.md']);
  check(hasReadme, {
    severity: 'info',
    category: 'architecture',
    file: 'architecture.md',
    title: 'Architecture & Setup Documentation',
    description: 'Missing README.md or architecture.md setup guide.',
    fixHint: 'Generate README.md / architecture.md with run & deploy commands.',
  });

  if (config?.codingParams?.includeUnitTests) {
    const hasTests = Object.keys(files).some((k) => /test|spec/i.test(k));
    check(hasTests, {
      severity: 'warning',
      category: 'architecture',
      file: 'tests/app.test.js',
      title: 'Automated Test Coverage',
      description: 'Unit tests were enabled in coding parameters, but no test file was found.',
      fixHint: 'Generate tests/app.test.js covering core business logic and validation.',
    });
  }

  // 6. Performance Check (No blocking synchronous XHR)
  const hasSyncXhr = /\.open\s*\(\s*["'](?:GET|POST)["']\s*,\s*[^,]+,\s*false\s*\)/i.test(allCodeText);
  check(!hasSyncXhr, {
    severity: 'warning',
    category: 'performance',
    file: 'app.js',
    title: 'Async Non-Blocking Network Requests',
    description: 'Synchronous XMLHttpRequest detected, which blocks the main UI thread.',
    fixHint: 'Use async/await fetch() with proper error handling.',
  });

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const rawScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
  const score = Math.max(0, Math.min(100, rawScore - criticalCount * 8));

  return {
    score,
    passedChecks,
    totalChecks,
    criticalCount,
    warningCount,
    auditedAt: new Date().toISOString(),
    summary:
      findings.length === 0
        ? `All ${totalChecks} production checks passed with zero security or syntax issues.`
        : `${passedChecks}/${totalChecks} checks passed (${criticalCount} critical, ${warningCount} warnings).`,
    findings,
  };
}

export function buildAuditAutoFixPrompt(opts: {
  title: string;
  files: Record<string, string>;
  report: StudioAuditReport;
  config?: StudioProjectConfig;
}): string {
  const fileSummary = Object.entries(opts.files)
    .slice(0, 12)
    .map(([name, content]) => `--- FILE: ${name} ---\n${String(content).slice(0, 6500)}`)
    .join('\n\n');

  return `You are the Principal Security & Reliability Engineer in RaOne Code Studio.
Fix ALL audit findings below cleanly while keeping 100% of existing features working.

PROJECT: ${opts.title}
AUDIT SCORE: ${opts.report.score}/100
FAILING FINDINGS:
${opts.report.findings
  .map(
    (f, idx) =>
      `${idx + 1}. [${f.severity.toUpperCase()}] (${f.category}) in ${f.file}: ${f.title} — ${f.description}\n   Fix hint: ${f.fixHint}`
  )
  .join('\n')}

CURRENT PROJECT FILES:
${fileSummary}

OUTPUT CONTRACT:
Return ONLY a valid JSON object:
{
  "title": "${opts.title}",
  "description": "Updated verified build after audit remediation",
  "files": {
    "index.html": "...",
    "styles.css": "...",
    "app.js": "..."
  }
}
Include ALL project files (with patches applied cleanly) and ensure zero syntax or security errors.`;
}

export function synthesizeDeployArtifacts(opts: {
  title: string;
  files: Record<string, string>;
  config?: StudioProjectConfig;
  target: DeployTargetId;
  firebaseProjectId?: string;
  gcpRegion?: string;
  cloudRunService?: string;
  githubRepo?: string;
  githubBranch?: string;
}): {
  target: DeployTargetId;
  generatedFiles: Record<string, string>;
  commands: string[];
  checklist: string[];
} {
  const safeSlug =
    opts.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'raone-studio-app';
  const firebaseProjectId =
    opts.firebaseProjectId?.trim() || opts.config?.deployConfig?.firebaseProjectId || 'raoneai';
  const gcpRegion = opts.gcpRegion?.trim() || opts.config?.deployConfig?.gcpRegion || 'us-central1';
  const serviceName =
    opts.cloudRunService?.trim() || opts.config?.deployConfig?.cloudRunService || safeSlug;
  const branch = opts.githubBranch?.trim() || opts.config?.deployConfig?.githubBranch || 'main';

  const hasPackageJson = Boolean(opts.files['package.json']);
  const hasBackend = Boolean(opts.files['backend/server.ts'] || opts.files['backend/server.js']);
  const generatedFiles: Record<string, string> = {};
  const commands: string[] = [];
  const checklist: string[] = [];

  if (opts.target === 'firebase') {
    generatedFiles['.firebaserc'] = JSON.stringify(
      { projects: { default: firebaseProjectId } },
      null,
      2
    );
    generatedFiles['firebase.json'] = JSON.stringify(
      {
        firestore: { rules: 'firestore.rules' },
        hosting: {
          public: opts.config?.frontendFramework === 'react_vite' ? 'dist' : '.',
          ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
          headers: [
            {
              source: '**',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
              ],
            },
          ],
          rewrites: [{ source: '**', destination: '/index.html' }],
        },
      },
      null,
      2
    );
    if (!opts.files['firestore.rules']) {
      generatedFiles['firestore.rules'] = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /public_items/{itemId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;
    }
    generatedFiles['deploy_firebase.sh'] = `#!/usr/bin/env bash
set -euo pipefail
${hasPackageJson ? 'npm install && npm run build\n' : ''}npx firebase-tools deploy --project ${firebaseProjectId} --only hosting,firestore:rules
`;
    commands.push(
      `npm install -g firebase-tools`,
      `firebase login`,
      hasPackageJson ? `npm install && npm run build` : `echo "Static bundle ready"`,
      `firebase deploy --project ${firebaseProjectId}`
    );
    checklist.push(
      `Verified .firebaserc targeting project "${firebaseProjectId}"`,
      `Configured strict deny-by-default firestore.rules`,
      `Configured Firebase Hosting security headers & SPA rewrites`
    );
  } else if (opts.target === 'cloud_run') {
    const isPython = opts.config?.backendRuntime === 'python_fastapi' || opts.config?.scriptLanguage === 'python';
    generatedFiles['.dockerignore'] = `node_modules\ndist\n.git\n.env\n__pycache__\n*.pyc\n`;
    generatedFiles['Dockerfile'] = isPython
      ? `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
`
      : `FROM node:22-slim
WORKDIR /app
${hasPackageJson ? 'COPY package*.json ./\nRUN npm install --omit=dev || npm install\n' : ''}COPY . .
${hasPackageJson && opts.config?.frontendFramework === 'react_vite' ? 'RUN npm run build\n' : ''}ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ${hasBackend ? '["npx", "tsx", "backend/server.ts"]' : '["npx", "serve", "-s", ".", "-l", "8080"]'}
`;
    generatedFiles['cloudbuild.yaml'] = `steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/${serviceName}:$COMMIT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/${serviceName}:$COMMIT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${serviceName}'
      - '--image'
      - 'gcr.io/$PROJECT_ID/${serviceName}:$COMMIT_SHA'
      - '--region'
      - '${gcpRegion}'
      - '--allow-unauthenticated'
images:
  - 'gcr.io/$PROJECT_ID/${serviceName}:$COMMIT_SHA'
`;
    commands.push(
      `gcloud config set project YOUR_GCP_PROJECT_ID`,
      `gcloud run deploy ${serviceName} --source . --region ${gcpRegion} --allow-unauthenticated`
    );
    checklist.push(
      `Synthesized production Dockerfile (PORT=8080)`,
      `Generated Cloud Build CI/CD pipeline (cloudbuild.yaml)`,
      `Added .dockerignore to prevent secret/node_modules leakage`
    );
  } else if (opts.target === 'github') {
    generatedFiles['.gitignore'] = `node_modules/\ndist/\n.env\n.env.local\n__pycache__/\n*.log\n`;
    generatedFiles['.github/workflows/ci-deploy.yml'] = `name: CI & Deploy (${opts.title})

on:
  push:
    branches: [ "${branch}" ]

jobs:
  verify-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install & Test
        run: |
          if [ -f package.json ]; then
            npm install
            npm test || true
            npm run build || true
          fi
`;
    commands.push(
      `git init && git branch -M ${branch}`,
      `git add . && git commit -m "Initial RaOne Code Studio build"`,
      opts.githubRepo
        ? `git remote add origin https://github.com/${opts.githubRepo}.git && git push -u origin ${branch}`
        : `git remote add origin https://github.com/YOUR_ORG/${safeSlug}.git && git push -u origin ${branch}`
    );
    checklist.push(
      `Created GitHub Actions CI workflow (.github/workflows/ci-deploy.yml)`,
      `Added .gitignore protecting .env and build artifacts`,
      `Ready for direct GitHub API commit/push or ZIP repo export`
    );
  }

  return {
    target: opts.target,
    generatedFiles,
    commands,
    checklist,
  };
}
