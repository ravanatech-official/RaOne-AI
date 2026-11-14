export type LocalLlmTransport = 'browser_direct' | 'backend_proxy';

export interface LocalLlmConfig {
  enabled: boolean;
  transport: LocalLlmTransport;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
}

export interface BrowserDetectedEngine {
  id: string;
  label: string;
  baseUrl: string;
  online: boolean;
  models: string[];
  latencyMs?: number;
}

const DEFAULT_LOCAL_LLM_CONFIG: LocalLlmConfig = {
  enabled: false,
  transport: 'browser_direct',
  baseUrl: 'http://127.0.0.1:8080/v1',
  modelId: '',
  apiKey: '',
};

export function getLocalLlmStorageKey(uid?: string | null): string {
  return `raone_local_llm_cfg_${uid || 'guest'}`;
}

export function normalizeLocalBaseUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/v1')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === '' || parsed.pathname === '/') {
      return `${trimmed}/v1`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const u = new URL(normalizeLocalBaseUrl(rawUrl));
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch {
    return false;
  }
}

export function readLocalLlmConfig(uid?: string | null): LocalLlmConfig {
  try {
    const raw = localStorage.getItem(getLocalLlmStorageKey(uid));
    if (!raw) return { ...DEFAULT_LOCAL_LLM_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LOCAL_LLM_CONFIG,
      ...parsed,
      baseUrl: normalizeLocalBaseUrl(parsed.baseUrl || DEFAULT_LOCAL_LLM_CONFIG.baseUrl),
    };
  } catch {
    return { ...DEFAULT_LOCAL_LLM_CONFIG };
  }
}

export function saveLocalLlmConfig(config: LocalLlmConfig, uid?: string | null): LocalLlmConfig {
  const normalized: LocalLlmConfig = {
    ...DEFAULT_LOCAL_LLM_CONFIG,
    ...config,
    baseUrl: normalizeLocalBaseUrl(config.baseUrl || DEFAULT_LOCAL_LLM_CONFIG.baseUrl),
  };
  try {
    localStorage.setItem(getLocalLlmStorageKey(uid), JSON.stringify(normalized));
  } catch {
    // ignore quota errors
  }
  return normalized;
}

const BROWSER_PROBE_CANDIDATES: Array<{ id: string; label: string; baseUrl: string }> = [
  { id: 'llama-cpp', label: 'llama.cpp (llama-server :8080)', baseUrl: 'http://127.0.0.1:8080/v1' },
  { id: 'raone-llama', label: 'RaOne Inbuilt llama-server (:8081)', baseUrl: 'http://127.0.0.1:8081/v1' },
  { id: 'ollama', label: 'Ollama (:11434)', baseUrl: 'http://localhost:11434/v1' },
  { id: 'lm-studio', label: 'LM Studio (:1234)', baseUrl: 'http://localhost:1234/v1' },
  { id: 'jan', label: 'Jan Local AI (:1337)', baseUrl: 'http://127.0.0.1:1337/v1' },
  { id: 'koboldcpp', label: 'KoboldCpp (:5001)', baseUrl: 'http://127.0.0.1:5001/v1' },
];

export async function fetchBrowserLocalModels(baseUrl: string, apiKey?: string, timeoutMs = 1800): Promise<string[]> {
  const cleanBase = normalizeLocalBaseUrl(baseUrl);
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const resp = await fetch(`${cleanBase}/models`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
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

export async function probeBrowserLocalServers(customBaseUrl?: string, apiKey?: string): Promise<BrowserDetectedEngine[]> {
  const list = [...BROWSER_PROBE_CANDIDATES];
  const cleanCustom = normalizeLocalBaseUrl(customBaseUrl || '');
  if (cleanCustom && !list.some((c) => c.baseUrl === cleanCustom)) {
    list.unshift({ id: 'custom', label: 'Custom Local Endpoint', baseUrl: cleanCustom });
  }

  return Promise.all(
    list.map(async (item): Promise<BrowserDetectedEngine> => {
      const start = Date.now();
      try {
        const models = await fetchBrowserLocalModels(item.baseUrl, apiKey, 1200);
        return {
          ...item,
          online: true,
          models,
          latencyMs: Date.now() - start,
        };
      } catch {
        return {
          ...item,
          online: false,
          models: [],
        };
      }
    })
  );
}

export async function streamLocalLlmFromBrowser(opts: {
  config: LocalLlmConfig;
  prompt: string;
  messages: Array<{ role: string; content: string }>;
  systemContext?: string;
  onChunk: (accumulatedText: string, meta?: any) => void;
  signal?: AbortSignal;
}): Promise<{ text: string; meta: any }> {
  const startMs = Date.now();
  const baseUrl = normalizeLocalBaseUrl(opts.config.baseUrl);
  if (!baseUrl) {
    throw new Error('Local LLM Base URL is empty. Configure it in Settings -> Local AI Engine.');
  }

  const modelName = (opts.config.modelId || 'local-model').replace(/^local:/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.config.apiKey) {
    headers.Authorization = `Bearer ${opts.config.apiKey}`;
  }

  const systemContent = [
    'You are RaOne AI running on a private Local Model Engine (llama.cpp / OpenAI-Compatible). Support Sinhala and English fluently with accurate, helpful answers.',
    opts.systemContext || '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const apiMessages = [
    { role: 'system', content: systemContent },
    ...(Array.isArray(opts.messages) ? opts.messages : []).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: opts.prompt },
  ];

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        model: modelName,
        messages: apiMessages,
        temperature: 0.7,
        stream: true,
      }),
    });
  } catch (networkErr: any) {
    throw new Error(
      `Could not reach local model server at ${baseUrl}. Make sure llama-server, Ollama (with OLLAMA_ORIGINS="*"), or LM Studio (CORS enabled) is running. (${networkErr?.message || 'Network error'})`
    );
  }

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Local model server returned ${response.status}: ${errText.slice(0, 200)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const textOut = json.choices?.[0]?.message?.content || '';
    const meta = {
      source: 'local_llm_direct',
      verifiedModel: json.model || modelName,
      modelVersion: json.model || modelName,
      responseId: json.id || null,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? 0,
            candidateTokens: json.usage.completion_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          }
        : null,
      latencyMs: Date.now() - startMs,
      elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
    };
    opts.onChunk(textOut, meta);
    return { text: textOut, meta };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let resolvedModel = modelName;
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
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          accumulated += delta;
          opts.onChunk(accumulated, { source: 'local_llm_direct', verifiedModel: resolvedModel });
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

  if (!accumulated) {
    throw new Error(`Empty response from local model server (${baseUrl}).`);
  }

  const finalMeta = {
    source: 'local_llm_direct',
    verifiedModel: resolvedModel,
    modelVersion: resolvedModel,
    responseId,
    usage,
    latencyMs: Date.now() - startMs,
    elapsedSec: ((Date.now() - startMs) / 1000).toFixed(1),
  };

  return { text: accumulated, meta: finalMeta };
}
