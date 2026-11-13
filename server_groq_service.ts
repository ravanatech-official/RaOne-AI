/**
 * Groq Cloud Service Configuration & Streaming Adapter
 * Dedicated alternative AI provider configuration for RaOne AI chat & SSE streaming.
 * Uses Groq's OpenAI-compatible LPU endpoint (api.groq.com/openai/v1) with dynamic
 * live model discovery via GET /models so model_not_found (404) errors are avoided.
 */

import { SYSTEM_PROMPT, buildRuntimeMetadataBlock } from './src/lib/systemPrompts.ts';

export type AIProviderMode = 'auto' | 'gemini' | 'groq';

export interface GroqModelDefinition {
  id: string;
  groqModelId: string;
  name: string;
  tag: string;
  description: string;
}

export interface GroqServiceConfig {
  provider: 'groq';
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  models: GroqModelDefinition[];
}

export const GROQ_SERVICE_CONFIG: GroqServiceConfig = {
  provider: 'groq',
  baseUrl: (process.env.GROQ_API_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
  defaultModel: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 4096,
  models: [
    {
      id: 'raone-llama3-70b',
      groqModelId: 'llama-3.3-70b-versatile',
      name: 'RaOne Llama 3.3 70B',
      tag: 'Groq Free · Ultra Fast',
      description: 'Meta Llama 3.3 70B Versatile running on Groq LPU (Free Tier + Ultra-Low Latency)',
    },
    {
      id: 'raone-llama4',
      groqModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
      name: 'RaOne Llama 4 Scout',
      tag: 'Meta Llama 4 · Groq',
      description: 'Meta Llama 4 Scout / Active Llama running on Groq LPU',
    },
    {
      id: 'raone-llama-fast',
      groqModelId: 'llama-3.1-8b-instant',
      name: 'RaOne Llama 3.1 8B Instant',
      tag: 'Groq Instant · Low Latency',
      description: 'Meta Llama 3.1 8B Instant for sub-second streaming responses',
    },
  ],
};

// Short-lived in-memory cache of active Groq chat models per API key prefix
const groqModelsCache = new Map<string, { models: string[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function isGroqChatModel(modelId: string): boolean {
  const id = String(modelId || '').toLowerCase();
  if (!id) return false;
  return !/whisper|tts|playai|orpheus|guard|safeguard|embedding|moderation/.test(id);
}

function isRetryableGroqModelError(status: number, errText: string): boolean {
  const lower = errText.toLowerCase();
  return (
    status === 404 ||
    lower.includes('model_not_found') ||
    lower.includes('model_decommissioned') ||
    lower.includes('does not exist') ||
    lower.includes('do not have access') ||
    lower.includes('decommissioned')
  );
}

export async function fetchLiveGroqModels(apiKey: string): Promise<string[]> {
  if (!apiKey) return [];
  const cacheKey = `${apiKey.slice(0, 12)}:${apiKey.length}`;
  const cached = groqModelsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.models.length > 0) {
    return cached.models;
  }

  try {
    const resp = await fetch(`${GROQ_SERVICE_CONFIG.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const list: string[] = Array.isArray(data?.data)
      ? data.data
          .map((item: any) => String(item?.id || ''))
          .filter((id: string) => isGroqChatModel(id))
      : [];
    if (list.length > 0) {
      groqModelsCache.set(cacheKey, { models: list, fetchedAt: Date.now() });
    }
    return list;
  } catch {
    return [];
  }
}

export function isGroqModelId(requestedModel: string): boolean {
  const m = String(requestedModel || '').toLowerCase();
  return (
    m === 'raone-llama3-70b' ||
    m === 'raone-llama4' ||
    m === 'raone-llama-fast' ||
    m.includes('llama-3.3') ||
    m.includes('llama-4') ||
    m.includes('llama-3.1') ||
    m.startsWith('meta-llama/')
  );
}

export function getGroqModelCandidates(requestedModel: string): string[] {
  const m = String(requestedModel || '').toLowerCase();
  if (m === 'raone-llama4' || m.includes('llama4') || m.includes('llama-4')) {
    return [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ];
  }
  if (m === 'raone-llama-fast' || m.includes('8b-instant') || m.includes('lite')) {
    return [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'openai/gpt-oss-20b',
    ];
  }
  return [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama3-70b-8192',
    'llama3-8b-8192',
  ];
}

async function resolveGroqCandidateQueue(apiKey: string, requestedModel: string): Promise<string[]> {
  const preferred = getGroqModelCandidates(requestedModel);
  const liveModels = await fetchLiveGroqModels(apiKey);
  if (liveModels.length === 0) {
    return preferred;
  }

  const liveSet = new Set(liveModels);
  const orderedLive: string[] = [];

  // 1. Add preferred models that actually exist on this Groq account
  for (const p of preferred) {
    if (liveSet.has(p) && !orderedLive.includes(p)) {
      orderedLive.push(p);
    }
  }

  // 2. If user asked for llama4 and exact ID wasn't matched, prioritize any live llama-4 model
  const reqLower = String(requestedModel || '').toLowerCase();
  if (reqLower.includes('llama4') || reqLower.includes('llama-4')) {
    for (const id of liveModels) {
      if (id.toLowerCase().includes('llama-4') && !orderedLive.includes(id)) {
        orderedLive.unshift(id);
      }
    }
  }

  // 3. Append any other live chat models (Llama, GPT-OSS, Qwen, DeepSeek, Gemma) sorted cleanly
  const priorityMatchers = [/llama-3\.3/, /llama-4/, /llama-3\.1/, /gpt-oss/, /qwen/, /deepseek/, /gemma/, /llama/];
  for (const matcher of priorityMatchers) {
    for (const id of liveModels) {
      if (matcher.test(id.toLowerCase()) && !orderedLive.includes(id)) {
        orderedLive.push(id);
      }
    }
  }
  for (const id of liveModels) {
    if (!orderedLive.includes(id)) {
      orderedLive.push(id);
    }
  }

  return orderedLive.length > 0 ? orderedLive : preferred;
}

export function formatGroqMessages(messages: any[], prompt: string, systemPrompt: string) {
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
    mapped.push({ role: 'user', content: 'Hello RaOne!' });
  }
  return [{ role: 'system', content: systemPrompt }, ...mapped];
}

export function isGeminiFallbackEligibleError(err: any): boolean {
  const errMsg = String(err?.message || '');
  const errStatus = err?.status || err?.code;
  return (
    errStatus === 402 ||
    errStatus === 401 ||
    errStatus === 403 ||
    errStatus === 429 ||
    /prepayment|depleted|resource_exhausted|api_key_invalid|quota/i.test(errMsg)
  );
}

function withGroqRuntimeSystemMessage(messages: any[], modelId: string, inject = true): any[] {
  if (!inject) return messages;
  const runtimeBlock = buildRuntimeMetadataBlock({
    provider: 'Groq Cloud LPU API',
    model: modelId,
    searchEnabled: false,
    mapsEnabled: false,
  });

  let patchedSystem = false;
  const next = messages.map((m) => {
    if (!patchedSystem && m?.role === 'system') {
      patchedSystem = true;
      const baseContent = String(m.content || '').trim();
      const withPersona = baseContent.includes('RaOne AI')
        ? baseContent
        : `${SYSTEM_PROMPT.trim()}\n\n${baseContent}`;
      return { ...m, content: `${withPersona}\n\n${runtimeBlock}` };
    }
    return m;
  });
  if (!patchedSystem) {
    next.unshift({ role: 'system', content: `${SYSTEM_PROMPT.trim()}\n\n${runtimeBlock}` });
  }
  return next;
}

export async function callGroqChat(
  apiKey: string,
  requestedModel: string,
  messages: any[],
  systemPrompt: string,
  maxTokens = GROQ_SERVICE_CONFIG.maxTokens,
  injectRuntimeContext = true,
  signal?: AbortSignal
): Promise<{ text: string; modelUsed: string; responseId: string | null; usage: any }> {
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured on the backend server.');
  const candidates = await resolveGroqCandidateQueue(apiKey, requestedModel);
  const baseFormattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
      .filter((m: any) => m && (m.content || m.parts?.[0]?.text))
      .map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || (m.parts?.[0]?.text ?? ''),
      })),
  ];

  let lastErr: Error | null = null;
  for (const modelId of candidates) {
    const formattedMessages = withGroqRuntimeSystemMessage(baseFormattedMessages, modelId, injectRuntimeContext);
    const response = await fetch(`${GROQ_SERVICE_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: formattedMessages,
        temperature: GROQ_SERVICE_CONFIG.temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      lastErr = new Error(`Groq API error (${response.status}): ${errText}`);
      if (isRetryableGroqModelError(response.status, errText)) {
        console.warn(`Groq model ${modelId} unavailable, trying next candidate...`);
        continue;
      }
      throw lastErr;
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
      modelUsed: json.model || modelId,
      responseId: json.id || null,
      usage,
    };
  }

  throw lastErr || new Error('All Groq model candidates failed.');
}

export async function streamGroqChatToSSE(
  apiKey: string,
  requestedModel: string,
  formattedMessages: any[],
  sendEvent: (payload: Record<string, any>) => void,
  startTime: number,
  injectRuntimeContext = true,
  signal?: AbortSignal
): Promise<void> {
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured on the backend server.');
  const candidates = await resolveGroqCandidateQueue(apiKey, requestedModel);
  let lastErr: Error | null = null;

  for (const modelId of candidates) {
    if (signal?.aborted) return;
    const messagesWithRuntime = withGroqRuntimeSystemMessage(formattedMessages, modelId, injectRuntimeContext);
    const response = await fetch(`${GROQ_SERVICE_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: messagesWithRuntime,
        temperature: GROQ_SERVICE_CONFIG.temperature,
        max_tokens: GROQ_SERVICE_CONFIG.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      lastErr = new Error(`Groq API error (${response.status}): ${errText}`);
      if (isRetryableGroqModelError(response.status, errText)) {
        console.warn(`Groq stream model ${modelId} unavailable, trying next candidate...`);
        continue;
      }
      throw lastErr;
    }

    sendEvent({ type: 'start', source: 'groq', model: modelId });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resolvedModel = modelId;
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
            sendEvent({ type: 'chunk', text: deltaText });
          }
          const xUsage = evt.x_groq?.usage || evt.usage;
          if (xUsage) {
            usage = {
              promptTokens: xUsage.prompt_tokens ?? 0,
              candidateTokens: xUsage.completion_tokens ?? 0,
              totalTokens: xUsage.total_tokens ?? 0,
            };
          }
        } catch {
          continue;
        }
      }
    }

    sendEvent({
      type: 'done',
      source: 'groq',
      verifiedModel: resolvedModel,
      modelVersion: resolvedModel,
      responseId,
      usage,
      latencyMs: Date.now() - startTime,
      groundingSources: [],
      mapsSources: [],
    });
    return;
  }

  throw lastErr || new Error('All Groq streaming candidates failed.');
}

export async function testGroqConnection(apiKey: string) {
  if (!apiKey) {
    throw new Error('Please enter a Groq API Key (gsk_...) to test.');
  }
  const start = Date.now();
  const availableModels = await fetchLiveGroqModels(apiKey);
  const result = await callGroqChat(
    apiKey,
    'raone-llama3-70b',
    [{ role: 'user', content: 'Reply with exactly: OK' }],
    'Reply with OK only.',
    16,
    false
  );
  return {
    success: true,
    model: result.modelUsed,
    responseId: result.responseId,
    availableModels,
    latencyMs: Date.now() - start,
    message: `Connected to Groq Cloud (${result.modelUsed}) in ${Date.now() - start}ms!`,
  };
}
