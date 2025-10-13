import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

type IncomingMessage = {
  role: string;
  content: string;
};

type ChatRequestBody = {
  messages?: unknown;
  model?: string;
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

const buildClient = () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured.');
  }

  const project = process.env.OPENAI_PROJECT_ID?.trim();
  const organization = process.env.OPENAI_ORGANIZATION?.trim() ?? process.env.OPENAI_ORG_ID?.trim();

  return createOpenAI({
    apiKey,
    project: project || undefined,
    organization: organization || undefined,
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

  const modelId = typeof body.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : 'gpt-4o-mini';

  try {
    const client = buildClient();
    const model = client(modelId);
    const result = await streamText({
      model,
      messages,
    });

    return result.toAIStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate a response.';
    return jsonResponse(502, { error: message });
  }
}
