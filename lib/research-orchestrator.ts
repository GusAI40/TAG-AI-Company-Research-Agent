import { RunnableLambda, RunnableSequence } from './langchain-lite.js';
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

export interface ReActStep {
  thought: string;
  action: string;
  observation: string;
}

export type AgentCompanyProfile = ResearchParsed['companies'][number];

export interface AgentResultPayload {
  research_trace: ReActStep[];
  summary_trace: ReActStep[];
  companies: AgentCompanyProfile[];
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
  agent: AgentResultPayload | null;
}

interface PipelineConfig {
  perplexityApiKey: string;
  perplexityUrl: string;
  openaiEnabled: boolean;
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

interface PipelineStateAgent extends PipelineStatePerplexity {
  agent: AgentResultPayload | null;
}

export class PipelineInputError extends Error {}
export class PipelineConfigurationError extends Error {}
export class PipelineRuntimeError extends Error {}

const MAX_RESULTS_DEFAULT = 6;
const MAX_RESULTS_CAP = 12;
const MIN_RESULTS = 1;

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

const createAgentPrompt = (
  body: IncomingBody,
  answer: string,
  sources: NormalisedResult[],
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
    lines.push('Key sources:\n' + formattedSources);
  }

  lines.push(
    'Create a concise marketing-ready profile covering mission, differentiation, scale, and founding year. Highlight one compelling hook for a finance-focused student audience.'
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

const agentStep = new RunnableLambda<PipelineStatePerplexity, PipelineStateAgent>(async (state) => {
  if (!state.config.openaiEnabled) {
    return { ...state, agent: null };
  }

  const agentPrompt = createAgentPrompt(state.body, state.perplexity.answer, state.perplexity.results);

  try {
    const workflowOutput = await runWorkflow({ input_as_text: agentPrompt });
    const researchParsed = workflowOutput.webResearchAgentResult.output_parsed;
    const summaryParsed = workflowOutput.summarizeAndDisplayResult.output_parsed;

    const { reasoning_trace: researchTrace, companies } = researchParsed;
    const { reasoning_trace: summaryTrace, ...summaryProfile } = summaryParsed;

    const agentResult: AgentResultPayload = {
      research_trace: researchTrace,
      summary_trace: summaryTrace,
      companies,
      summary: summaryProfile,
      raw: {
        research: workflowOutput.webResearchAgentResult.output_text,
        summary: workflowOutput.summarizeAndDisplayResult.output_text,
      },
    };

    return { ...state, agent: agentResult };
  } catch (error) {
    throw new PipelineRuntimeError(
      error instanceof Error ? error.message : 'Agent workflow failed to complete.'
    );
  }
});

const finalStep = new RunnableLambda<PipelineStateAgent, ResearchPipelineOutput>(async (state) => ({
  context: {
    query: state.query,
    focus: state.focus,
    topK: state.topK,
  },
  perplexity: state.perplexity,
  agent: state.agent,
}));

let cachedPipeline: RunnableSequence<PipelineInput, ResearchPipelineOutput> | null = null;

const getPipeline = (): RunnableSequence<PipelineInput, ResearchPipelineOutput> => {
  if (!cachedPipeline) {
    cachedPipeline = RunnableSequence.from<PipelineInput, ResearchPipelineOutput>([
      initialStep,
      perplexityStep,
      agentStep,
      finalStep,
    ]);
  }
  return cachedPipeline;
};

export const runResearchPipeline = async (
  input: PipelineInput,
): Promise<ResearchPipelineOutput> => {
  return await getPipeline().invoke(input);
};
