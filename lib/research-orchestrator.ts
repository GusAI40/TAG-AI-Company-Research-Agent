import { RunnableLambda, RunnableSequence } from './langchain-lite.js';
import { resolveAgentProvider, buildCandidateJsonStrings } from './openai-agents.js';
import { runWorkflow } from '../agents/pitchguard-workflow.js';
import type { WorkflowOutput } from '../agents/pitchguard-workflow.js';

export interface IncomingBody {
  company?: string;
  topic?: string;
  industry?: string;
  hq_location?: string;
  focus?: unknown;
  query?: string;
  max_results?: number;
}

export interface NormalisedResult {
  title: string;
  url?: string;
  snippet: string;
  score?: number;
  published_at?: string;
}

export interface NormalisedPerplexityResponse {
  query: string;
  answer: string;
  results: NormalisedResult[];
  usage: Record<string, unknown> | null;
}

export type ResearchParsed = WorkflowOutput['webResearchAgentResult']['output_parsed'];
export type SummaryParsed = WorkflowOutput['summarizeAndDisplayResult']['output_parsed'];

export type AgentProfile = ResearchParsed['profile'];
export type AgentMetricSection = ResearchParsed['metric_sections'][number];
export type AgentDiligenceQuestion = ResearchParsed['diligence_questions'][number];
export type AgentWatchItem = ResearchParsed['watch_items'][number];

export interface ReActStep {
  thought: string;
  action: string;
  observation: string;
}

export interface AgentResultPayload {
  research_trace: ReActStep[];
  summary_trace: ReActStep[];
  profile: AgentProfile;
  metric_sections: AgentMetricSection[];
  watch_items: AgentWatchItem[];
  diligence_questions: AgentDiligenceQuestion[];
  summary: Omit<SummaryParsed, 'reasoning_trace'>;
  raw: {
    research: string;
    summary: string;
  };
}

export interface ResearchPipelineOutput {
  context: {
    query: string;
    focus?: string[];
    topK: number;
  };
  perplexity: NormalisedPerplexityResponse;
  deepResearch: GeminiDeepResearchFinding | null;
  deepResearchError: string | null;
  agent: AgentResultPayload | null;
  agentError: string | null;
}

interface PipelineConfig {
  perplexityApiKey: string;
  perplexityUrl: string;
  agentEnabled: boolean;
  agentDisabledReason?: string;
  geminiDeepResearch?: {
    apiKey: string;
    model: string;
    endpoint: string;
  };
}

interface PipelineInput {
  body: IncomingBody;
  config: PipelineConfig;
}

interface PipelineStateBase extends PipelineInput {
  query: string;
  focus?: string[];
  topK: number;
}

interface PipelineStatePerplexity extends PipelineStateBase {
  perplexity: NormalisedPerplexityResponse;
}

interface PipelineStateDeepResearch extends PipelineStatePerplexity {
  deepResearch: GeminiDeepResearchFinding | null;
  deepResearchError?: string;
}

interface PipelineStateAgent extends PipelineStateDeepResearch {
  agent: AgentResultPayload | null;
  agentError?: string;
}

export class PipelineInputError extends Error {}
export class PipelineConfigurationError extends Error {}
export class PipelineRuntimeError extends Error {}

const MAX_RESULTS_DEFAULT = 6;
const MAX_RESULTS_CAP = 12;
const MIN_RESULTS = 1;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

const geminiModelAvailabilityCache = new Map<string, Promise<Set<string>>>();

const buildGeminiModelCacheKey = (endpoint: string, apiKey: string): string => {
  const keySuffix = apiKey.length > 12 ? apiKey.slice(-12) : apiKey;
  return `${endpoint}|${keySuffix}`;
};

const fetchAvailableGeminiModels = async (
  endpoint: string,
  apiKey: string,
): Promise<Set<string>> => {
  const cacheKey = buildGeminiModelCacheKey(endpoint, apiKey);
  const cached = geminiModelAvailabilityCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const response = await fetch(
      `${endpoint}/models?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      const preview = await response.text().catch(() => '');
      throw new Error(
        `Failed to list Gemini models: status ${response.status} ${preview.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as GeminiModelListResponse;
    const names = new Set<string>();

    for (const model of data.models ?? []) {
      if (typeof model?.name !== 'string' || !model.name.trim()) {
        continue;
      }

      const supported = model.supportedGenerationMethods;
      if (Array.isArray(supported) && supported.length > 0) {
        const supportsGenerateContent = supported.some(
          (method) => typeof method === 'string' && method.toLowerCase() === 'generatecontent',
        );
        if (!supportsGenerateContent) {
          continue;
        }
      }

      names.add(model.name);
      if (model.name.startsWith('models/')) {
        names.add(model.name.replace(/^models\//, ''));
      }
    }

    if (names.size === 0) {
      throw new Error('No Gemini models with generateContent support were returned.');
    }

    return names;
  })();

  geminiModelAvailabilityCache.set(cacheKey, request);
  request.catch(() => {
    geminiModelAvailabilityCache.delete(cacheKey);
  });
  return request;
};

export interface GeminiDeepResearchFinding {
  summary: string;
  insights: string[];
  sources: NormalisedResult[];
  raw: string;
}

const normaliseString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normaliseIncomingBody = (raw: unknown): IncomingBody => {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const data = raw as Record<string, unknown>;
  return {
    company: normaliseString(data.company),
    topic: normaliseString(data.topic),
    industry: normaliseString(data.industry),
    hq_location: normaliseString(data.hq_location),
    focus: data.focus,
    query: normaliseString(data.query),
    max_results: typeof data.max_results === 'number' ? data.max_results : undefined,
  };
};

const buildQuery = (body: IncomingBody): string => {
  if (body.query) {
    return body.query;
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

  if (typeof focus === 'string') {
    const trimmed = focus.trim();
    return trimmed ? [trimmed] : undefined;
  }

  return undefined;
};

const clampResults = (value: number | undefined): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= MIN_RESULTS) {
    return Math.min(Math.max(Math.floor(value), MIN_RESULTS), MAX_RESULTS_CAP);
  }
  return MAX_RESULTS_DEFAULT;
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
    url:
      typeof result.url === 'string'
        ? result.url
        : typeof result.source === 'string'
          ? result.source
          : undefined,
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

const normaliseDeepResearchSources = (sources: unknown): NormalisedResult[] => {
  if (!Array.isArray(sources)) {
    return [];
  }

  const seen = new Set<string>();
  const normalised: NormalisedResult[] = [];

  for (const entry of sources) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const candidates = [record.url, record.href, record.link].filter((value): value is unknown => value !== undefined);
    let url: string | undefined;
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') {
        continue;
      }
      const trimmed = candidate.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          url = parsed.href;
          break;
        }
      } catch (error) {
        // ignore invalid URLs
      }
    }

    if (url && seen.has(url)) {
      continue;
    }

    const rawTitle =
      typeof record.title === 'string'
        ? record.title
        : typeof record.name === 'string'
          ? record.name
          : undefined;
    let title = rawTitle?.trim();
    if (!title || title.length === 0) {
      title = url ? new URL(url).hostname.replace(/^www\./i, '') : 'Gemini Deep Research Source';
    }

    const snippetCandidate =
      typeof record.snippet === 'string'
        ? record.snippet
        : typeof record.summary === 'string'
          ? record.summary
          : typeof record.note === 'string'
            ? record.note
            : '';

    const snippet = snippetCandidate.trim();

    if (url) {
      seen.add(url);
    }

    normalised.push({
      title: title || 'Gemini Deep Research Source',
      url,
      snippet,
      score: undefined,
      published_at: undefined,
    });
  }

  return normalised;
};

const coerceInsights = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (item && typeof item === 'object' && 'text' in item && typeof (item as Record<string, unknown>).text === 'string') {
          return ((item as Record<string, unknown>).text as string).trim();
        }
        return '';
      })
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const parseGeminiDeepResearch = (rawText: string): GeminiDeepResearchFinding => {
  const candidates = buildCandidateJsonStrings(rawText);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;

      const summaryCandidate =
        typeof parsed.summary === 'string'
          ? parsed.summary
          : typeof parsed.synthesis === 'string'
            ? parsed.synthesis
            : '';
      const summary = summaryCandidate.trim();

      const insights = coerceInsights(
        parsed.insights ?? parsed.takeaways ?? parsed.highlights ?? parsed.points ?? parsed.notes,
      );

      const sources = normaliseDeepResearchSources(
        parsed.sources ?? parsed.citations ?? parsed.references ?? parsed.links,
      );

      if (!summary && insights.length === 0 && sources.length === 0) {
        throw new Error('Parsed payload was empty.');
      }

      const clean = {
        summary,
        insights,
        sources,
      } satisfies Omit<GeminiDeepResearchFinding, 'raw'>;

      return {
        ...clean,
        raw: JSON.stringify(clean, null, 2),
      };
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Unknown parsing error';
  throw new Error(`Failed to parse Gemini Deep Research output: ${message}`);
};

const executeGeminiDeepResearch = async (
  state: PipelineStatePerplexity,
  config: NonNullable<PipelineConfig['geminiDeepResearch']>,
): Promise<GeminiDeepResearchFinding> => {
  const focusLine = state.focus && state.focus.length > 0 ? `Focus topics: ${state.focus.join(', ')}` : undefined;

  const candidateSources = state.perplexity.results
    .slice(0, state.topK)
    .map((source, index) => `${index + 1}. ${source.title}${source.url ? ` — ${source.url}` : ''}`)
    .join('\n');

  const promptSections = [
    'You are Gemini Deep Research supporting the Ole Miss Finance Club diligence committee. Respond with verified facts only.',
    `Primary query: ${state.query}`,
    focusLine,
    state.perplexity.answer ? `Baseline synthesis from Perplexity:\n${state.perplexity.answer}` : undefined,
    candidateSources ? `Candidate sources:\n${candidateSources}` : undefined,
    'Return strict JSON matching this schema (no markdown, no commentary):',
    '{"summary": string, "insights": string[], "sources": [{"title": string, "url": string, "snippet": string}]}',
    'Rules:',
    '- Summary: maximum three sentences, reference fiscal periods from filings when available.',
    '- Insights: 3-6 one-sentence bullets focused on KPIs (YoY revenue, margins, FCF, liquidity, valuation, guidance).',
    '- Sources: Prefer SEC filings, investor relations, reputable financial outlets. Every URL must be https and point directly to the cited material.',
    '- If data is unavailable, omit rather than speculate.',
  ].filter((section): section is string => Boolean(section));

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: promptSections.join('\n\n'),
          },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };

  const endpoint = (config.endpoint || GEMINI_API_BASE).replace(/\/$/, '');
  const fallbackModels = ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-2.5-flash', 'gemini-2.5-pro'];
  let modelsToTry = Array.from(
    new Set(
      [config.model, ...fallbackModels].filter(
        (model): model is string => typeof model === 'string' && model.trim().length > 0,
      ),
    ),
  );

  let availabilityHint: string | null = null;
  try {
    const availableModels = await fetchAvailableGeminiModels(endpoint, config.apiKey);
    const filtered = modelsToTry.filter(
      (model) => availableModels.has(model) || availableModels.has(`models/${model}`),
    );
    if (filtered.length > 0) {
      modelsToTry = filtered;
    } else {
      availabilityHint = `None of the preferred models are enabled. Available models: ${Array.from(availableModels).join(', ')}`;
    }
  } catch (error) {
    availabilityHint = error instanceof Error ? error.message : String(error);
  }

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `${endpoint}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const preview = await response.text().catch(() => '');
        const error = new Error(
          `Gemini Deep Research request failed for model ${model} with status ${response.status}: ${preview.slice(0, 400)}`,
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = (data.candidates ?? [])
        .flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!rawText) {
        const error = new Error(
          `Gemini Deep Research response from model ${model} did not contain any text.`,
        ) as Error & { status?: number };
        error.status = 204;
        throw error;
      }

      return parseGeminiDeepResearch(rawText);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (lastError as Error & { status?: number }).status;
      if (status && status !== 404 && status !== 400) {
        break;
      }
    }
  }

  const attempted = modelsToTry.join(', ');
  const message = lastError?.message ?? 'Unknown Gemini Deep Research failure.';
  const hint = availabilityHint ? ` Availability hint: ${availabilityHint}` : '';
  throw new Error(`Gemini Deep Research request failed after trying models (${attempted}). Last error: ${message}.${hint}`);
};

const createAgentPrompt = (
  body: IncomingBody,
  answer: string,
  sources: NormalisedResult[],
  deepResearch?: GeminiDeepResearchFinding | null,
): string => {
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
    lines.push('Perplexity key sources:\n' + formattedSources);
  }

  if (deepResearch) {
    if (deepResearch.summary) {
      lines.push('Gemini Deep Research synthesis:\n' + deepResearch.summary);
    }

    if (deepResearch.insights.length > 0) {
      const insightBlock = deepResearch.insights
        .slice(0, 6)
        .map((insight, index) => `${index + 1}. ${insight}`)
        .join('\n');
      lines.push('Gemini Deep Research insights:\n' + insightBlock);
    }

    if (deepResearch.sources.length > 0) {
      const geminiSources = deepResearch.sources
        .slice(0, 6)
        .map((source, index) => `${index + 1}. ${source.title} — ${source.url ?? 'no url provided'}`)
        .join('\n');
      lines.push('Gemini Deep Research sources:\n' + geminiSources);
    }
  }

  lines.push(
    [
      'Produce a finance diligence brief for the Ole Miss Finance Club.',
      'Anchor on the latest SEC filing (10-K/10-Q) and specify the fiscal period.',
      'Capture revenue, YoY growth, margin quality, free cash flow, liquidity (cash vs. debt), share count/dilution, and guidance if available.',
      'Surface 2-3 watch items (risks/opportunities) and 3+ diligence questions members can use to pressure-test a stock pitch.',
      'Keep bullets tight—no paragraphs, no marketing fluff.'
    ].join(' ')
  );

  return lines.join('\n\n');
};

const initialStep = new RunnableLambda<PipelineInput, PipelineStateBase>(async (input) => {
  const query = buildQuery(input.body);
  if (!query) {
    throw new PipelineInputError('A query, company name, or topic must be provided.');
  }

  return {
    ...input,
    query,
    focus: normaliseFocus(input.body.focus),
    topK: clampResults(input.body.max_results),
  };
});

const perplexityStep = new RunnableLambda<PipelineStateBase, PipelineStatePerplexity>(async (state) => {
  if (!state.config.perplexityApiKey) {
    throw new PipelineConfigurationError('Perplexity integration is not configured.');
  }

  const payload: Record<string, unknown> = {
    query: state.query,
    top_k: state.topK,
  };

  if (state.focus) {
    payload.focus = state.focus;
  }

  const response = await fetch(state.config.perplexityUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.config.perplexityApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const preview = await response.text().catch(() => '');
    throw new PipelineRuntimeError(
      `Perplexity search failed with status ${response.status}: ${preview.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as {
    answer?: string;
    summary?: string;
    results?: Array<Record<string, unknown>>;
    usage?: Record<string, unknown>;
  };

  const normalised: NormalisedPerplexityResponse = {
    query: state.query,
    answer:
      typeof data.answer === 'string' && data.answer
        ? data.answer
        : typeof data.summary === 'string'
          ? data.summary
          : '',
    results: normaliseResults(data.results),
    usage: data.usage ?? null,
  };

  return { ...state, perplexity: normalised };
});

const deepResearchStep = new RunnableLambda<PipelineStatePerplexity, PipelineStateDeepResearch>(async (state) => {
  const config = state.config.geminiDeepResearch;
  if (!config) {
    return { ...state, deepResearch: null, deepResearchError: undefined };
  }

  try {
    const finding = await executeGeminiDeepResearch(state, config);
    return { ...state, deepResearch: finding, deepResearchError: undefined };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gemini Deep Research request failed to complete.';
    return { ...state, deepResearch: null, deepResearchError: message };
  }
});

const agentStep = new RunnableLambda<PipelineStateDeepResearch, PipelineStateAgent>(async (state) => {
  if (!state.config.agentEnabled) {
    return {
      ...state,
      agent: null,
      agentError: state.config.agentDisabledReason ?? undefined,
    };
  }

  const agentPrompt = createAgentPrompt(
    state.body,
    state.perplexity.answer,
    state.perplexity.results,
    state.deepResearch,
  );

  try {
    const workflowOutput = await runWorkflow({ input_as_text: agentPrompt });
    const researchParsed = workflowOutput.webResearchAgentResult.output_parsed;
    const summaryParsed = workflowOutput.summarizeAndDisplayResult.output_parsed;

    const {
      reasoning_trace: researchTrace,
      profile,
      metric_sections,
      watch_items,
      diligence_questions,
    } = researchParsed;
    const { reasoning_trace: summaryTrace, ...summaryProfile } = summaryParsed;

    const agentResult: AgentResultPayload = {
      research_trace: researchTrace,
      summary_trace: summaryTrace,
      profile,
      metric_sections,
      watch_items,
      diligence_questions,
      summary: summaryProfile,
      raw: {
        research: workflowOutput.webResearchAgentResult.output_text,
        summary: workflowOutput.summarizeAndDisplayResult.output_text,
      },
    };

    return { ...state, agent: agentResult, agentError: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Agent workflow failed to complete.';
    return { ...state, agent: null, agentError: message };
  }
});

const finalStep = new RunnableLambda<PipelineStateAgent, ResearchPipelineOutput>(async (state) => ({
  context: {
    query: state.query,
    focus: state.focus,
    topK: state.topK,
  },
  perplexity: state.perplexity,
  deepResearch: state.deepResearch ?? null,
  deepResearchError: state.deepResearchError ?? null,
  agent: state.agent,
  agentError: state.agentError ?? null,
}));

let cachedPipeline: RunnableSequence<PipelineInput, ResearchPipelineOutput> | null = null;

const getPipeline = (): RunnableSequence<PipelineInput, ResearchPipelineOutput> => {
  if (!cachedPipeline) {
    cachedPipeline = RunnableSequence.from<PipelineInput, ResearchPipelineOutput>([
      initialStep,
      perplexityStep,
      deepResearchStep,
      agentStep,
      finalStep,
    ]);
  }
  return cachedPipeline;
};

export const runResearchPipeline = async (
  input: PipelineInput,
): Promise<ResearchPipelineOutput> => {
  const { provider, reason } = await resolveAgentProvider();

  const pipelineInput: PipelineInput = {
    ...input,
    config: {
      ...input.config,
      agentEnabled: provider !== null,
      agentDisabledReason: provider === null ? reason : undefined,
    },
  };

  return await getPipeline().invoke(pipelineInput);
};
