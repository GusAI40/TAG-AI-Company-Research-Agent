import { runWorkflow } from '../../agents/pitchguard-workflow.js';
import type { WorkflowOutput } from '../../agents/pitchguard-workflow.js';

export const config = {
  runtime: 'nodejs',
};

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

interface IncomingBody {
  company?: string;
  topic?: string;
  industry?: string;
  hq_location?: string;
  focus?: unknown;
  query?: string;
  max_results?: number;
}

interface NormalisedResult {
  title: string;
  url?: string;
  snippet: string;
  score?: number;
  published_at?: string;
}

interface PerplexityResponse {
  answer?: string;
  summary?: string;
  results?: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
}

type ResearchParsed = WorkflowOutput['webResearchAgentResult']['output_parsed'];
type SummaryParsed = WorkflowOutput['summarizeAndDisplayResult']['output_parsed'];

interface ReActStep {
  thought: string;
  action: string;
  observation: string;
}

type AgentCompanyProfile = ResearchParsed['companies'][number];

interface AgentResultPayload {
  research_trace: ReActStep[];
  summary_trace: ReActStep[];
  companies: AgentCompanyProfile[];
  summary: Omit<SummaryParsed, 'reasoning_trace'>;
  raw: {
    research: string;
    summary: string;
  };
}

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
    title:
      typeof result.title === 'string' && result.title.trim()
        ? result.title.trim()
        : typeof result.name === 'string' && result.name.trim()
          ? result.name.trim()
          : 'Untitled result',
    url: typeof result.url === 'string' ? result.url : typeof result.source === 'string' ? result.source : undefined,
    snippet:
      typeof result.snippet === 'string'
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

const clampResults = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric) && numeric >= MIN_RESULTS) {
    return Math.min(Math.max(Math.floor(numeric), MIN_RESULTS), MAX_RESULTS_CAP);
  }
  return MAX_RESULTS_DEFAULT;
};

const createAgentPrompt = (body: IncomingBody, answer: string, sources: NormalisedResult[]): string => {
  const lines: string[] = [];
  if (body.company) {
    lines.push(`Company: ${body.company}`);
  }
  if (body.industry) {
    lines.push(`Industry: ${body.industry}`);
  }
  if (body.hq_location) {
    lines.push(`Headquarters: ${body.hq_location}`);
  }
  if (body.topic) {
    lines.push(`Focus topic: ${body.topic}`);
  }

  if (answer) {
    lines.push('Perplexity synthesis:\n' + answer);
  }

  if (sources.length > 0) {
    const formattedSources = sources
      .slice(0, 6)
      .map((source, index) => `${index + 1}. ${source.title} — ${source.url ?? 'no url provided'}`)
      .join('\n');
    lines.push('Key sources:\n' + formattedSources);
  }

  lines.push(
    'Create a concise marketing-ready profile covering mission, differentiation, scale, and founding year. Highlight one compelling hook for a finance-focused student audience.'
  );

  return lines.join('\n\n');
};

const respond = (res: VercelResponse, status: number, data: Record<string, unknown>) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data));
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    respond(res, 500, {
      error: 'Perplexity integration is not configured. Set PERPLEXITY_API_KEY to enable this endpoint.',
    });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    respond(res, 500, {
      error: 'OpenAI Agents require OPENAI_API_KEY. Configure it to enable the agentic workflow.',
    });
    return;
  }

  const body: IncomingBody = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});

  const query = buildQuery(body);
  if (!query) {
    respond(res, 400, { error: 'A query, company name, or topic must be provided.' });
    return;
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

  let perplexityData: PerplexityResponse;

  try {
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
      respond(res, response.status, {
        error: `Perplexity search failed with status ${response.status}.`,
        details: preview.slice(0, 400),
      });
      return;
    }

    perplexityData = (await response.json()) as PerplexityResponse;
  } catch (error) {
    respond(res, 502, {
      error: 'Failed to contact the Perplexity Search API.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }

  const normalised = {
    query,
    answer: typeof perplexityData.answer === 'string' && perplexityData.answer
      ? perplexityData.answer
      : typeof perplexityData.summary === 'string'
        ? perplexityData.summary
        : '',
    results: normaliseResults(perplexityData.results),
    usage: perplexityData.usage ?? null,
  };

  const agentPrompt = createAgentPrompt(body, normalised.answer, normalised.results);

  let agentResult: AgentResultPayload | null = null;
  try {
    const workflowOutput = await runWorkflow({ input_as_text: agentPrompt });
    const researchParsed = workflowOutput.webResearchAgentResult.output_parsed;
    const summaryParsed = workflowOutput.summarizeAndDisplayResult.output_parsed;

    const { reasoning_trace: researchTrace, companies } = researchParsed;
    const { reasoning_trace: summaryTrace, ...summaryProfile } = summaryParsed;

    agentResult = {
      research_trace: researchTrace,
      summary_trace: summaryTrace,
      companies,
      summary: summaryProfile,
      raw: {
        research: workflowOutput.webResearchAgentResult.output_text,
        summary: workflowOutput.summarizeAndDisplayResult.output_text,
      },
    };
  } catch (error) {
    console.error('Agent workflow failed', error);
    agentResult = null;
  }

  respond(res, 200, {
    status: 'completed',
    perplexity: normalised,
    agent: agentResult,
  });
}
