export const runtime = 'edge';

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';

const parseContentType = (request: Request): string => {
  const header = request.headers.get('content-type');
  return header ? header.split(';')[0].trim().toLowerCase() : '';
};

const decodeBase64 = (payload: string): Uint8Array => {
  const cleaned = payload.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const inferExtension = (mimeType: string | null | undefined): string => {
  if (!mimeType) {
    return 'webm';
  }

  const mapping: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
  };

  return mapping[mimeType] || 'webm';
};

const buildHeaders = (apiKey: string, projectId?: string | null, organizationId?: string | null) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (projectId && projectId.trim()) {
    headers['OpenAI-Project'] = projectId.trim();
  }

  if (organizationId && organizationId.trim()) {
    headers['OpenAI-Organization'] = organizationId.trim();
  }

  return headers;
};

const extractJsonError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const error = (payload as Record<string, unknown>).error;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }
    }
    return JSON.stringify(payload);
  } catch (error) {
    return `Upstream error (${response.status}): ${response.statusText}`;
  }
};

const buildJsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return buildJsonResponse(405, { error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildJsonResponse(500, {
      error: 'Missing OPENAI_API_KEY environment variable.',
    });
  }

  const projectId = process.env.OPENAI_PROJECT_ID;
  const organizationId = process.env.OPENAI_ORG_ID || process.env.OPENAI_ORGANIZATION_ID;

  const contentType = parseContentType(request);

  let audioBlob: Blob | null = null;
  let prompt: string | undefined;
  let responseFormat: string | undefined;
  let language: string | undefined;
  let model: string | undefined;

  try {
    if (contentType === 'application/json') {
      const body = (await request.json()) as Record<string, unknown>;
      const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : undefined;
      prompt = typeof body.prompt === 'string' ? body.prompt : undefined;
      responseFormat = typeof body.responseFormat === 'string' ? body.responseFormat : undefined;
      language = typeof body.language === 'string' ? body.language : undefined;
      model = typeof body.model === 'string' ? body.model : undefined;
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';

      if (!audioBase64) {
        return buildJsonResponse(400, {
          error: 'audioBase64 is required when sending JSON payloads.',
        });
      }

      const buffer = decodeBase64(audioBase64);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      audioBlob = new File([arrayBuffer], `recording.${inferExtension(mimeType)}`, {
        type: mimeType,
      });
    } else if (contentType === 'multipart/form-data') {
      const formData = await request.formData();
      const fileEntry = formData.get('file');
      const promptEntry = formData.get('prompt');
      const responseFormatEntry = formData.get('response_format');
      const languageEntry = formData.get('language');
      const modelEntry = formData.get('model');

      if (fileEntry instanceof File) {
        audioBlob = fileEntry;
      }

      if (typeof promptEntry === 'string') {
        prompt = promptEntry;
      }

      if (typeof responseFormatEntry === 'string') {
        responseFormat = responseFormatEntry;
      }

      if (typeof languageEntry === 'string') {
        language = languageEntry;
      }

      if (typeof modelEntry === 'string') {
        model = modelEntry;
      }
    } else {
      return buildJsonResponse(415, {
        error: 'Unsupported content-type. Use application/json or multipart/form-data.',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse request body.';
    return buildJsonResponse(400, { error: message });
  }

  if (!audioBlob) {
    return buildJsonResponse(400, { error: 'No audio file or audioBase64 payload was provided.' });
  }

  const upstreamFormData = new FormData();
  upstreamFormData.append('file', audioBlob);
  upstreamFormData.append('model', model?.trim() || DEFAULT_MODEL);

  if (prompt) {
    upstreamFormData.append('prompt', prompt);
  }

  if (responseFormat) {
    upstreamFormData.append('response_format', responseFormat);
  }

  if (language) {
    upstreamFormData.append('language', language);
  }

  const upstreamResponse = await fetch(OPENAI_TRANSCRIBE_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey, projectId, organizationId),
    body: upstreamFormData,
  });

  if (!upstreamResponse.ok) {
    const errorMessage = await extractJsonError(upstreamResponse);
    return buildJsonResponse(upstreamResponse.status, { error: errorMessage });
  }

  let transcript: unknown;
  try {
    transcript = await upstreamResponse.json();
  } catch (error) {
    transcript = await upstreamResponse.text();
  }

  return buildJsonResponse(200, {
    success: true,
    transcript,
  });
}
