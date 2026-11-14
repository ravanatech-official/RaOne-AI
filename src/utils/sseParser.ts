export interface ParsedSseEvent {
  eventType: string;
  dataRaw: string;
  json: any | null;
}

/**
 * Splits a raw SSE stream buffer into complete parsed events plus any remaining
 * incomplete trailing frame. Normalizes CRLF/CR line endings and follows
 * WHATWG Server-Sent Events rules for `data:` lines.
 */
export function parseSseBuffer(rawBuffer: string): {
  events: ParsedSseEvent[];
  rest: string;
} {
  const normalized = rawBuffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: ParsedSseEvent[] = [];

  for (const block of blocks) {
    const parsed = parseSingleSseBlock(block);
    if (parsed) {
      events.push(parsed);
    }
  }

  return { events, rest };
}

/**
 * Flushes any final incomplete SSE frame left in the buffer when the stream closes.
 */
export function flushSseBuffer(remainingBuffer: string): ParsedSseEvent[] {
  const normalized = remainingBuffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  const parsed = parseSingleSseBlock(normalized);
  return parsed ? [parsed] : [];
}

function parseSingleSseBlock(block: string): ParsedSseEvent | null {
  const lines = block.split('\n');
  let eventType = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventType = line.slice(6).replace(/^ /, '').trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;

  const dataRaw = dataLines.join('\n').trim();
  if (!dataRaw || dataRaw === '[DONE]') {
    return null;
  }

  let json: any = null;
  try {
    json = JSON.parse(dataRaw);
  } catch {
    json = null;
  }

  return { eventType, dataRaw, json };
}

/**
 * Extracts text delta from either RaOne SSE events (`{ type: 'chunk', text }`)
 * or OpenAI-compatible delta frames (`{ choices: [{ delta: { content } }] }`).
 */
export function extractSseTextDelta(evt: any): string {
  if (!evt || typeof evt !== 'object') return '';
  if (evt.type === 'chunk' && typeof evt.text === 'string') {
    return evt.text;
  }
  const openAiDelta = evt.choices?.[0]?.delta?.content;
  if (typeof openAiDelta === 'string') {
    return openAiDelta;
  }
  return '';
}
