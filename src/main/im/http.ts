import { app, session } from 'electron';

// Fallback for cases where Electron session is not ready yet.
const nodeFetch = require('node-fetch');
const ALLOWED_HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function validateHttpUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!ALLOWED_HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

function linkAbortSignal(source: AbortSignal, controller: AbortController): void {
  if (source.aborted) {
    controller.abort();
    return;
  }
  source.addEventListener('abort', () => controller.abort(), { once: true });
}

export async function fetchWithSystemProxy(url: string, options: RequestInit = {}): Promise<Response> {
  const validatedUrl = validateHttpUrl(url);
  if (app.isReady()) {
    try {
      return await session.defaultSession.fetch(validatedUrl, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[IM HTTP] session fetch failed, fallback to node-fetch: ${message}`);
    }
  }

  return nodeFetch(validatedUrl, options);
}

function formatLimit(maxBytes: number): string {
  if (maxBytes >= 1024 * 1024) {
    return `${(maxBytes / 1024 / 1024).toFixed(1)}MB`;
  }
  if (maxBytes >= 1024) {
    return `${(maxBytes / 1024).toFixed(1)}KB`;
  }
  return `${maxBytes}B`;
}

export async function readResponseBufferWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`Response too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB (limit ${formatLimit(maxBytes)})`);
    }
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const appendChunk = (chunk: Uint8Array | Buffer) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error(`Response exceeded limit of ${formatLimit(maxBytes)}`);
    }
    chunks.push(buffer);
  };

  const body: any = response.body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) appendChunk(value);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // no-op
      }
    }
    return Buffer.concat(chunks, total);
  }

  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
      appendChunk(chunk);
    }
    return Buffer.concat(chunks, total);
  }

  const fallbackBuffer = Buffer.from(await response.arrayBuffer());
  if (fallbackBuffer.length > maxBytes) {
    throw new Error(`Response exceeded limit of ${formatLimit(maxBytes)}`);
  }
  return fallbackBuffer;
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000
): Promise<T> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  if (options.signal) {
    linkAbortSignal(options.signal, timeoutController);
  }

  try {
    const response = await fetchWithSystemProxy(url, {
      ...options,
      signal: timeoutController.signal,
    });

    const rawText = await response.text();
    let data: unknown = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Expected JSON response but got: ${rawText.slice(0, 120)}`);
      }
    }

    if (!response.ok) {
      const payload = data as { description?: string; message?: string } | null;
      const detail = payload?.description || payload?.message || rawText || response.statusText || 'request failed';
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
