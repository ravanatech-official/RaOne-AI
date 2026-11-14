import fs from 'fs';
import path from 'path';
import dns from 'dns/promises';
import net from 'net';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT, buildRuntimeMetadataBlock } from './src/lib/systemPrompts.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LOCAL_MODELS_DIR = path.join(__dirname, 'models');

export interface GgufModelFile {
  filename: string;
  sizeBytes: number;
  sizeLabel: string;
}

export interface DetectedLocalRuntime {
  id: string;
  label: string;
  baseUrl: string;
  online: boolean;
  models: string[];
  latencyMs?: number;
}

export interface ManagedLlamaState {
  running: boolean;
  pid: number | null;
  modelFile: string | null;
  port: number;
  endpointUrl: string | null;
  startedAt: string | null;
  recentLogs: string[];
}

export function isCloudRunRuntime(): boolean {
  return Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB);
}

export function isLocalLoopbackAllowed(): boolean {
  if (process.env.ALLOW_LOCAL_LLM_LOOPBACK === 'true') return true;
  if (process.env.ALLOW_LOCAL_LLM_LOOPBACK === 'false') return false;
  return !isCloudRunRuntime();
}

export function isLocalProcessSpawnAllowed(): boolean {
  if (process.env.ALLOW_LOCAL_LLM_PROCESS === 'true') return true;
  if (process.env.ALLOW_LOCAL_LLM_PROCESS === 'false') return false;
  return !isCloudRunRuntime();
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/v1')) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.pathname === '' || u.pathname === '/') {
      return `${trimmed}/v1`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function isPrivateNonLoopbackIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '');
  if (net.isIPv4(normalized)) {
    const octets = normalized.split('.').map(Number);
    if (octets.length !== 4) return true;
    const [a, b] = octets;
    if (a === 127) return false; // handled separately by loopback rule
    if (a === 0 || a === 10) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (lower === '::1') return false;
    if (lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
    return false;
  }
  return true;
}

export async function validateLocalLlmEndpoint(rawUrl: string): Promise<
  | { ok: true; normalizedBaseUrl: string; isLoopback: boolean }
  | { ok: false; reason: string }
> {
  const normalizedBaseUrl = normalizeBaseUrl(rawUrl);
  if (!normalizedBaseUrl) {
    return { ok: false, reason: 'Local LLM Base URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedBaseUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL format.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Embedded credentials in URLs are not permitted.' };
  }

  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';

  if (isLoopback) {
    if (!isLocalLoopbackAllowed()) {
      return {
        ok: false,
        reason:
          'Cloud Run cannot reach localhost on your PC. Either select "Browser Direct (localhost)" in Settings or expose your local llama.cpp server with an HTTPS tunnel (e.g., Cloudflare Tunnel).',
      };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'Local loopback URL must use http:// or https://.' };
    }
    const portNum = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
    if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
      return { ok: false, reason: 'Local LLM port must be between 1024 and 65535.' };
    }
    return { ok: true, normalizedBaseUrl, isLoopback: true };
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: 'Remote/tunneled Local LLM endpoints must use HTTPS (e.g. https://xxxx.trycloudflare.com/v1).',
    };
  }

  if (host.endsWith('.local') || host.endsWith('.internal') || net.isIP(host) !== 0) {
    return { ok: false, reason: 'Private LAN IPs and internal hostnames are blocked for remote proxy safety.' };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: 'DNS lookup returned no records for endpoint host.' };
    }
    for (const rec of records) {
      const cleanIp = rec.address.replace(/^::ffff:/i, '');
      if (cleanIp === '127.0.0.1' || cleanIp === '::1' || isPrivateNonLoopbackIp(rec.address)) {
        return { ok: false, reason: 'Endpoint hostname resolved to a private or reserved network IP.' };
      }
    }
  } catch {
    return { ok: false, reason: 'Could not resolve DNS for the specified HTTPS endpoint.' };
  }

  return { ok: true, normalizedBaseUrl, isLoopback: false };
}

// =========================================================================
// Inbuilt GGUF Scanner & Managed llama.cpp (`llama-server`) Controller
// =========================================================================
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function listLocalGgufModels(): GgufModelFile[] {
  try {
    if (!fs.existsSync(LOCAL_MODELS_DIR)) {
      return [];
    }
    const entries = fs.readdirSync(LOCAL_MODELS_DIR, { withFileTypes: true });
    const files: GgufModelFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.gguf')) continue;
      const fullPath = path.join(LOCAL_MODELS_DIR, entry.name);
      const stat = fs.statSync(fullPath);
      if (stat.size > 0) {
        files.push({
          filename: entry.name,
          sizeBytes: stat.size,
          sizeLabel: formatFileSize(stat.size),
        });
      }
    }
    return files.sort((a, b) => a.filename.localeCompare(b.filename));
  } catch {
    return [];
  }
}

export function findLlamaServerBinary(): string | null {
  const configured = (process.env.LLAMA_SERVER_BIN || '').trim();
  if (configured && fs.existsSync(configured)) {
    return configured;
  }
  const candidates = process.platform === 'win32'
    ? ['llama-server.exe', 'llama-server']
    : ['llama-server'];
  const locator = process.platform === 'win32' ? 'where' : 'which';
  for (const bin of candidates) {
    const res = spawnSync(locator, [bin], { encoding: 'utf8', timeout: 1500 });
    if (res.status === 0 && res.stdout) {
      const first = res.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (first) return first;
    }
  }
  return null;
}

let managedChild: ChildProcess | null = null;
let managedMeta: Omit<ManagedLlamaState, 'running' | 'pid'> = {
  modelFile: null,
  port: 8081,
  endpointUrl: null,
  startedAt: null,
  recentLogs: [],
};

function pushLog(line: string) {
  const cleaned = line.trim();
  if (!cleaned) return;
  managedMeta.recentLogs = [...managedMeta.recentLogs.slice(-24), cleaned];
}

export function getManagedLlamaState(): ManagedLlamaState {
  const running = Boolean(managedChild && !managedChild.killed && managedChild.exitCode === null);
  return {
    running,
    pid: running && managedChild?.pid ? managedChild.pid : null,
    modelFile: running ? managedMeta.modelFile : null,
    port: managedMeta.port,
    endpointUrl: running ? managedMeta.endpointUrl : null,
    startedAt: running ? managedMeta.startedAt : null,
    recentLogs: managedMeta.recentLogs,
  };
}

export async function startManagedLlamaServer(opts: {
  modelFile: string;
  port?: number;
  contextSize?: number;
  gpuLayers?: number;
}): Promise<ManagedLlamaState> {
  if (!isLocalProcessSpawnAllowed()) {
    throw new Error(
      'Spawning llama-server inside a Cloud Run container is disabled. Run llama.cpp or Ollama locally on your PC and connect via Browser Direct or Cloudflare Tunnel.'
    );
  }

  const bin = findLlamaServerBinary();
  if (!bin) {
    throw new Error(
      'llama-server binary not found on PATH. Install llama.cpp (or set LLAMA_SERVER_BIN) to launch GGUF files directly.'
    );
  }

  const safeName = path.basename(String(opts.modelFile || '').trim());
  if (!safeName || !safeName.toLowerCase().endsWith('.gguf') || safeName !== opts.modelFile) {
    throw new Error('Invalid GGUF model filename.');
  }

  const modelPath = path.join(LOCAL_MODELS_DIR, safeName);
  if (!fs.existsSync(modelPath)) {
    throw new Error(`GGUF model file "${safeName}" was not found inside ./models/`);
  }

  await stopManagedLlamaServer();

  const port = Number.isInteger(opts.port) && opts.port! >= 1024 && opts.port! <= 65535 ? opts.port! : 8081;
  const ctxSize = Number.isInteger(opts.contextSize) && opts.contextSize! >= 512 && opts.contextSize! <= 131072
    ? opts.contextSize!
    : 4096;

  const args = [
    '-m',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '-c',
    String(ctxSize),
    '--cors-allow-origin',
    '*',
  ];
  if (typeof opts.gpuLayers === 'number' && opts.gpuLayers >= 0) {
    args.push('-ngl', String(Math.floor(opts.gpuLayers)));
  }

  managedMeta = {
    modelFile: safeName,
    port,
    endpointUrl: `http://127.0.0.1:${port}/v1`,
    startedAt: new Date().toISOString(),
    recentLogs: [`Starting llama-server on 127.0.0.1:${port} with ${safeName}...`],
  };

  const child = spawn(bin, args, {
    cwd: LOCAL_MODELS_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  managedChild = child;

  child.stdout?.on('data', (chunk: Buffer) => {
    chunk.toString('utf8').split(/\r?\n/).forEach(pushLog);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    chunk.toString('utf8').split(/\r?\n/).forEach(pushLog);
  });
  child.on('exit', (code, signal) => {
    pushLog(`llama-server exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`);
    if (managedChild === child) {
      managedChild = null;
    }
  });

  // Briefly verify it did not immediately crash
  await new Promise((r) => setTimeout(r, 600));
  if (child.exitCode !== null) {
    throw new Error(`llama-server exited immediately: ${managedMeta.recentLogs.slice(-3).join(' | ')}`);
  }

  return getManagedLlamaState();
}

export async function stopManagedLlamaServer(): Promise<ManagedLlamaState> {
  const child = managedChild;
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolve(null);
      }, 2000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  }
  managedChild = null;
  return getManagedLlamaState();
}

// =========================================================================
// Local Runtime Auto-Discovery & OpenAI-Compatible Chat/SSE Adapter
// =========================================================================
const DEFAULT_LOCAL_CANDIDATES: Array<{ id: string; label: string; baseUrl: string }> = [
  { id: 'raone-managed', label: 'RaOne Inbuilt llama-server', baseUrl: 'http://127.0.0.1:8081/v1' },
  { id: 'llama-cpp', label: 'llama.cpp (llama-server :8080)', baseUrl: 'http://127.0.0.1:8080/v1' },
  { id: 'ollama', label: 'Ollama (:11434)', baseUrl: 'http://127.0.0.1:11434/v1' },
  { id: 'lm-studio', label: 'LM Studio (:1234)', baseUrl: 'http://127.0.0.1:1234/v1' },
  { id: 'jan', label: 'Jan Local AI (:1337)', baseUrl: 'http://127.0.0.1:1337/v1' },
  { id: 'koboldcpp', label: 'KoboldCpp (:5001)', baseUrl: 'http://127.0.0.1:5001/v1' },
];

export async function fetchOpenAiCompatibleModels(
  baseUrl: string,
  apiKey?: string,
  timeoutMs = 1500
): Promise<string[]> {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const resp = await fetch(`${cleanBase}/models`, {
    method: 'GET',
    redirect: 'error',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    throw new Error(`Endpoint returned HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (Array.isArray(data?.data)) {
    return data.data.map((m: any) => String(m?.id || m?.name || '')).filter(Boolean);
  }
  if (Array.isArray(data?.models)) {
    return data.models.map((m: any) => String(m?.name || m?.id || '')).filter(Boolean);
  }
  return [];
}

export async function probeLocalServersFromBackend(): Promise<DetectedLocalRuntime[]> {
  if (!isLocalLoopbackAllowed()) {
    return [];
  }

  const results = await Promise.all(
    DEFAULT_LOCAL_CANDIDATES.map(async (candidate): Promise<DetectedLocalRuntime> => {
      const start = Date.now();
      try {
        const models = await fetchOpenAiCompatibleModels(candidate.baseUrl, undefined, 900);
        return {
          ...candidate,
          online: true,
          models,
          latencyMs: Date.now() - start,
        };
      } catch {
        return {
          ...candidate,
          online: false,
          models: [],
        };
      }
    })
  );

  return results;
}

export function getActiveLocalEndpointConfig(byok: {
  localLlmBaseUrl?: string;
  localLlmModel?: string;
  localLlmApiKey?: string;
}) {
  const managed = getManagedLlamaState();
  const baseUrl = normalizeBaseUrl(
    byok.localLlmBaseUrl ||
      (managed.running && managed.endpointUrl ? managed.endpointUrl : '') ||
      process.env.LOCAL_LLM_BASE_URL ||
      ''
  );
  const modelId = String(
    byok.localLlmModel ||
      (managed.running && managed.modelFile ? managed.modelFile : '') ||
      process.env.LOCAL_LLM_MODEL ||
      'local-model'
  ).trim();
  const apiKey = byok.localLlmApiKey || process.env.LOCAL_LLM_API_KEY || '';
  return { baseUrl, modelId, apiKey };
}

function buildLocalChatMessages(messages: any[], prompt: string, systemPrompt: string, modelId: string) {
  const runtimeBlock = buildRuntimeMetadataBlock({
    provider: 'RaOne Local AI Engine (llama.cpp / OpenAI-Compatible)',
    model: modelId,
    searchEnabled: false,
    mapsEnabled: false,
  });
  const baseSys = systemPrompt?.includes('RaOne AI')
    ? systemPrompt
    : `${SYSTEM_PROMPT.trim()}\n\n${systemPrompt || ''}`.trim();

  const mapped = (Array.isArray(messages) ? messages : [])
    .filter((m: any) => m && (m.content || m.parts?.[0]?.text))
    .map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || (m.parts?.[0]?.text ?? ''),
    }));

  if (prompt) {
    mapped.push({ role: 'user', content: prompt });
  }
  if (mapped.length === 0) {
    mapped.push({ role: 'user', content: 'Hello!' });
  }

  return [{ role: 'system', content: `${baseSys}\n\n${runtimeBlock}` }, ...mapped];
}

export async function callLocalLlmChat(opts: {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  messages: any[];
  prompt: string;
  systemPrompt: string;
  signal?: AbortSignal;
}): Promise<{ text: string; modelUsed: string; responseId: string | null; usage: any }> {
  const check = await validateLocalLlmEndpoint(opts.baseUrl);
  if (!check.ok) {
    throw new Error(check.reason);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const modelToUse = opts.modelId.replace(/^local:/, '') || 'local-model';
  const formattedMessages = buildLocalChatMessages(opts.messages, opts.prompt, opts.systemPrompt, modelToUse);

  const response = await fetch(`${check.normalizedBaseUrl}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    signal: opts.signal,
    headers,
    body: JSON.stringify({
      model: modelToUse,
      messages: formattedMessages,
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Local LLM error (${response.status}): ${errText.slice(0, 240)}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content || '';
  const usage = json.usage
    ? {
        promptTokens: json.usage.prompt_tokens ?? 0,
        candidateTokens: json.usage.completion_tokens ?? 0,
        totalTokens: json.usage.total_tokens ?? 0,
      }
    : null;

  return {
    text,
    modelUsed: json.model || modelToUse,
    responseId: json.id || null,
    usage,
  };
}

export async function streamLocalLlmToSSE(opts: {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  messages: any[];
  prompt: string;
  systemPrompt: string;
  sendEvent: (payload: Record<string, any>) => void;
  startTime: number;
  signal?: AbortSignal;
}): Promise<void> {
  const check = await validateLocalLlmEndpoint(opts.baseUrl);
  if (!check.ok) {
    throw new Error(check.reason);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const modelToUse = opts.modelId.replace(/^local:/, '') || 'local-model';
  const formattedMessages = buildLocalChatMessages(opts.messages, opts.prompt, opts.systemPrompt, modelToUse);

  const response = await fetch(`${check.normalizedBaseUrl}/chat/completions`, {
    method: 'POST',
    redirect: 'error',
    signal: opts.signal,
    headers,
    body: JSON.stringify({
      model: modelToUse,
      messages: formattedMessages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(`Local LLM streaming error (${response.status}): ${errText.slice(0, 240)}`);
  }

  opts.sendEvent({ type: 'start', source: 'local_llm', model: modelToUse });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resolvedModel = modelToUse;
  let responseId: string | null = null;
  let usage: any = null;

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
        if (evt.id) responseId = evt.id;
        if (evt.model) resolvedModel = evt.model;
        const deltaText = evt.choices?.[0]?.delta?.content;
        if (typeof deltaText === 'string' && deltaText.length > 0) {
          opts.sendEvent({ type: 'chunk', text: deltaText });
        }
        if (evt.usage) {
          usage = {
            promptTokens: evt.usage.prompt_tokens ?? 0,
            candidateTokens: evt.usage.completion_tokens ?? 0,
            totalTokens: evt.usage.total_tokens ?? 0,
          };
        }
      } catch {
        continue;
      }
    }
  }

  opts.sendEvent({
    type: 'done',
    source: 'local_llm',
    verifiedModel: resolvedModel,
    modelVersion: resolvedModel,
    responseId,
    usage,
    latencyMs: Date.now() - opts.startTime,
    groundingSources: [],
    mapsSources: [],
  });
}
