type IncomingMessage = {
  role: string;
  content: string;
};

type ChatRequestBody = {
  messages?: unknown;
  model?: string;
  responseFormat?: string;
  jsonSchema?: unknown;
};

const defaultModel = process.env.AI_CHAT_MODEL?.trim() || 'gpt-4o-mini';

const parseFallbackModels = (): string[] => {
  const raw = process.env.AI_CHAT_FALLBACK_MODELS;
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const parseMessages = (payload: unknown): IncomingMessage[] => {
  if (!Array.isArray(payload)) {
    throw new Error('`messages` must be an array.');
  }

  const parsed = payload
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const role = 'role' in item ? (item as Record<string, unknown>).role : undefined;
      const content = 'content' in item ? (item as Record<string, unknown>).content : undefined;

      if (typeof role !== 'string' || typeof content !== 'string') {
        return null;
      }

      return { role, content } as IncomingMessage;
    })
    .filter((item): item is IncomingMessage => item !== null);

  if (parsed.length === 0) {
    throw new Error('No valid chat messages were provided.');
  }

  return parsed;
};

const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';

const normalizeBaseUrl = (value?: string | null): string => {
  if (!value) {
    return OPENAI_BASE_URL;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return OPENAI_BASE_URL;
  }

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }

  const sanitized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  if (sanitized.endsWith('/v1')) {
    return `${sanitized}/chat/completions`;
  }

  return `${sanitized}/chat/completions`;
};

const buildHeaders = (apiKey: string, project?: string | null, organization?: string | null) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (project && project.trim().length > 0) {
    headers['OpenAI-Project'] = project.trim();
  }

  const org = organization?.trim();
  if (org) {
    headers['OpenAI-Organization'] = org;
  }

  return headers;
};

const extractDeltaText = (payload: Record<string, unknown>): string => {
  const choices = Array.isArray(payload.choices) ? (payload.choices as unknown[]) : [];
  if (choices.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') {
      continue;
    }

    const delta = (choice as Record<string, unknown>).delta;
    if (!delta || typeof delta !== 'object') {
      continue;
    }

    const record = delta as Record<string, unknown>;

    if (typeof record.content === 'string') {
      parts.push(record.content);
      continue;
    }

    if (Array.isArray(record.content)) {
      for (const item of record.content) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const text = (item as Record<string, unknown>).text;
        if (typeof text === 'string') {
          parts.push(text);
        }
      }
      continue;
    }

    if (typeof record.text === 'string') {
      parts.push(record.text);
    }
  }

  return parts.join('');
};

const createSseStream = (source: ReadableStream<Uint8Array>) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      let buffer = '';
      let completed = false;

      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const processBuffer = () => {
        while (true) {
          const boundary = buffer.indexOf('\n\n');
          if (boundary === -1) {
            return;
          }

          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) {
              continue;
            }

            const data = line.slice(5).trim();
            if (!data) {
              continue;
            }

            if (data === '[DONE]') {
              completed = true;
              send({ type: 'done' });
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              if (parsed.error && typeof parsed.error === 'object') {
                const message =
                  typeof (parsed.error as Record<string, unknown>).message === 'string'
                    ? ((parsed.error as Record<string, unknown>).message as string)
                    : 'OpenAI returned an error.';
                throw new Error(message);
              }

              const text = extractDeltaText(parsed);
              if (text) {
                send({ type: 'delta', delta: { text } });
              }
            } catch (error) {
              controller.error(error);
              return;
            }
          }
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          processBuffer();
          if (completed) {
            return;
          }
        }

        if (!completed && buffer.trim().length > 0) {
          buffer += '\n\n';
          processBuffer();
          if (completed) {
            return;
          }
        }

        if (!completed) {
          send({ type: 'done' });
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse request body.';
    return jsonResponse(400, { error: message });
  }

  let messages: IncomingMessage[];
  try {
    messages = parseMessages(body.messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid chat payload.';
    return jsonResponse(400, { error: message });
  }

  const requestedModel = typeof body.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : null;
  const modelCandidates = Array.from(
    new Set([requestedModel ?? defaultModel, ...parseFallbackModels()])
  );

  const responseFormat = body.responseFormat === 'json_schema' ? 'json_schema' : 'text';
  const jsonSchema = body.jsonSchema;

  if (responseFormat === 'json_schema' && (typeof jsonSchema !== 'object' || jsonSchema === null)) {
    return jsonResponse(400, {
      error: 'jsonSchema must be provided when responseFormat is set to "json_schema".',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(500, { error: 'OpenAI API key is not configured.' });
  }

  const project = process.env.OPENAI_PROJECT_ID?.trim() ?? null;
  const organization =
    process.env.OPENAI_ORGANIZATION?.trim() ?? process.env.OPENAI_ORG_ID?.trim() ?? null;
  const url = normalizeBaseUrl(process.env.AI_GATEWAY_URL);

  let lastError: Error | null = null;

  for (const candidate of modelCandidates) {
    try {
      const payload: Record<string, unknown> = {
        model: candidate,
        messages,
        stream: true,
      };

      if (responseFormat === 'json_schema') {
        payload.response_format = {
          type: 'json_schema',
          json_schema: jsonSchema as Record<string, unknown>,
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(apiKey, project, organization),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = `OpenAI request failed with status ${response.status}.`;
        try {
          const errorPayload = (await response.json()) as Record<string, unknown>;
          if (errorPayload?.error && typeof errorPayload.error === 'object') {
            const detail = (errorPayload.error as Record<string, unknown>).message;
            if (typeof detail === 'string' && detail.trim().length > 0) {
              message = detail.trim();
            }
          }
        } catch (parseError) {
          // ignore parsing issues, fall back to default message
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('OpenAI response did not include a body to stream.');
      }

      const stream = createSseStream(response.body);
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-AI-Model': candidate,
        },
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unable to generate a response.');
    }
  }

  const message = lastError?.message ?? 'Unable to generate a response.';
  return jsonResponse(502, { error: message });
}
