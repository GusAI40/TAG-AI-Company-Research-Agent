type HealthResult = {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency_ms: number | null;
  status_code?: number;
  message?: string;
};

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

const respond = (res: VercelResponse, status: number, payload: unknown) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
};

const acceptableCodes = new Set([200, 201, 202, 204, 400, 401, 403, 404, 405]);

const time = async <T>(fn: () => Promise<T>): Promise<{ value: T; latency: number | null }> => {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, latency: Date.now() - start };
  } catch (error) {
    if (error instanceof Error && /fetch failed/i.test(error.message)) {
      return { value: error as unknown as T, latency: null };
    }
    throw error;
  }
};

const probe = async (
  name: string,
  url: string,
  options: RequestInit = {},
  treatStatus: (status: number) => boolean = (status) => acceptableCodes.has(status),
  maskMessage = false
): Promise<HealthResult> => {
  try {
    const { value: response, latency } = await time(() => fetch(url, options));
    const statusCode = (response as Response).status;
    const ok = treatStatus(statusCode);
    const status: HealthResult['status'] = ok ? 'online' : 'degraded';
    const message = maskMessage
      ? undefined
      : ok
      ? (response as Response).statusText || 'reachable'
      : `Unexpected status ${statusCode}`;

    return {
      name,
      status,
      latency_ms: latency,
      status_code: statusCode,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return {
      name,
      status: 'offline',
      latency_ms: null,
      message,
    };
  }
};

const buildHealthReport = async (): Promise<{ results: HealthResult[]; timestamp: string }> => {
  const checks: Promise<HealthResult>[] = [];

  const perplexityUrl = process.env.PERPLEXITY_SEARCH_URL ?? 'https://api.perplexity.ai/search';
  checks.push(
    probe(
      'Perplexity Search API',
      perplexityUrl,
      { method: 'OPTIONS' },
      (status) => acceptableCodes.has(status)
    )
  );

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    checks.push(
      probe(
        'OpenAI Models',
        'https://api.openai.com/v1/models?limit=1',
        {
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
        },
        (status) => acceptableCodes.has(status)
      )
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const endpoint = process.env.GEMINI_DEEP_RESEARCH_URL?.trim() ?? 'https://generativelanguage.googleapis.com/v1beta/models';
    const url = `${endpoint}`.includes('models') ? endpoint : `${endpoint}/models`;
    checks.push(
      probe(
        'Gemini Models',
        `${url}?pageSize=1&key=${geminiKey}`,
        { method: 'GET' },
        (status) => acceptableCodes.has(status),
        true
      )
    );
  }

  const secUserAgent = process.env.SEC_USER_AGENT ?? 'PitchGuard/1.0 (olemiss-finance-club@example.com)';
  checks.push(
    probe(
      'SEC Submissions API',
      'https://data.sec.gov/submissions/CIK0000320193.json',
      {
        headers: {
          'User-Agent': secUserAgent,
          Accept: 'application/json',
        },
      },
      (status) => acceptableCodes.has(status)
    )
  );

  const results = await Promise.all(checks);
  return { results, timestamp: new Date().toISOString() };
};

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method && req.method !== 'GET') {
    respond(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const report = await buildHealthReport();
  respond(res, 200, report);
}
