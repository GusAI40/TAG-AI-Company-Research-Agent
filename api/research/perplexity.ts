export const config = {
  runtime: 'edge',
};

type IncomingBody = {
  company?: string;
  topic?: string;
  industry?: string;
  hq_location?: string;
  focus?: unknown;
  query?: string;
  max_results?: number;
};

type NormalisedResult = {
  title: string;
  url?: string;
  snippet: string;
  score?: number;
  published_at?: string;
};

type PerplexityResponse = {
  answer?: string;
  summary?: string;
  results?: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
};

const HEADERS = {
  'Content-Type': 'application/json',
};

const MAX_RESULTS_DEFAULT = 6;
const MAX_RESULTS_CAP = 12;
const MIN_RESULTS = 1;

const buildQuery = (body: IncomingBody): string => {
  const explicit = typeof body.query === 'string' ? body.query.trim() : '';
  if (explicit) {
    return explicit;
  }

  const segments: string[] = [];
  if (body.company) {
    segments.push(`Company: ${body.company}`);
  }
  if (body.topic) {
    segments.push(`Topic: ${body.topic}`);
  }
  if (body.industry) {
    segments.push(`Industry: ${body.industry}`);
  }
  if (body.hq_location) {
    segments.push(`HQ: ${body.hq_location}`);
  }

  return segments.join('. ').trim();
};

const normaliseFocus = (focus: unknown): string[] | undefined => {
  if (!focus) {
    return undefined;
  }

  if (Array.isArray(focus)) {
    const cleaned = focus
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof focus === 'string' && focus.trim()) {
    return [focus.trim()];
  }

  return undefined;
};

const normaliseResults = (results: Array<Record<string, unknown>> | undefined): NormalisedResult[] => {
  if (!results || results.length === 0) {
    return [];
  }

  return results.map((result) => ({
    title: (typeof result.title === 'string' && result.title.trim())
      ? result.title.trim()
      : (typeof result.name === 'string' && result.name.trim())
        ? result.name.trim()
        : 'Untitled result',
    url: typeof result.url === 'string' ? result.url : (typeof result.source === 'string' ? result.source : undefined),
    snippet: typeof result.snippet === 'string'
      ? result.snippet
      : typeof result.text === 'string'
        ? result.text
        : typeof result.description === 'string'
          ? result.description
          : '',
    score: typeof result.score === 'number' ? result.score : undefined,
    published_at: typeof result.published_at === 'string' ? result.published_at : undefined,
  }));
};

const jsonResponse = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: HEADERS,
  });

const clampResults = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric) && numeric >= MIN_RESULTS) {
    return Math.min(Math.max(Math.floor(numeric), MIN_RESULTS), MAX_RESULTS_CAP);
  }
  return MAX_RESULTS_DEFAULT;
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, {
      error: 'Perplexity integration is not configured. Set PERPLEXITY_API_KEY to enable this endpoint.',
    });
  }

  let body: IncomingBody | null = null;
  try {
    body = (await request.json()) as IncomingBody;
  } catch (parseError) {
    return jsonResponse(400, { error: 'Invalid JSON payload.' });
  }

  if (!body) {
    return jsonResponse(400, { error: 'Request payload is required.' });
  }

  const query = buildQuery(body);
  if (!query) {
    return jsonResponse(400, { error: 'A query, company name, or topic must be provided.' });
  }

  const focus = normaliseFocus(body.focus);
  const topK = clampResults(body.max_results);

  const payload: Record<string, unknown> = {
    query,
    top_k: topK,
  };

  if (focus) {
    payload.focus = focus;
  }

  const response = await fetch(process.env.PERPLEXITY_SEARCH_URL ?? 'https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const preview = await response.text().catch(() => '');
    return jsonResponse(response.status, {
      error: `Perplexity search failed with status ${response.status}.`,
      details: preview.slice(0, 400),
    });
  }

  const data = (await response.json()) as PerplexityResponse;
  const normalised = {
    query,
    answer: typeof data.answer === 'string' && data.answer ? data.answer : typeof data.summary === 'string' ? data.summary : '',
    results: normaliseResults(data.results),
    usage: data.usage ?? null,
  };

  return jsonResponse(200, {
    status: 'completed',
    result: normalised,
  });
}
