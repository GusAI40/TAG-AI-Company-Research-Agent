import {
  normaliseIncomingBody,
  runResearchPipeline,
  PipelineInputError,
  PipelineConfigurationError,
  PipelineRuntimeError,
} from '../../lib/research-orchestrator.js';

export const config = {
  runtime: 'nodejs',
};

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
};

const respond = (res: VercelResponse, status: number, data: Record<string, unknown>) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data));
};

const parseBody = (payload: unknown): unknown => {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON payload';
      throw new PipelineInputError(`Invalid JSON body provided: ${message}`);
    }
  }
  return payload ?? {};
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    respond(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const perplexityUrl = process.env.PERPLEXITY_SEARCH_URL ?? 'https://api.perplexity.ai/search';
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiDeepResearchModel =
    process.env.GEMINI_DEEP_RESEARCH_MODEL?.trim() ?? 'gemini-2.0-deep-research';
  const geminiDeepResearchEndpoint =
    process.env.GEMINI_DEEP_RESEARCH_URL?.trim() ?? 'https://generativelanguage.googleapis.com/v1beta';

  const geminiDeepResearch = geminiKey
    ? {
        apiKey: geminiKey,
        model: geminiDeepResearchModel,
        endpoint: geminiDeepResearchEndpoint,
      }
    : undefined;

  const rawBody = parseBody(req.body);
  const body = normaliseIncomingBody(rawBody);

  try {
    const result = await runResearchPipeline({
      body,
      config: {
        perplexityApiKey: perplexityApiKey ?? '',
        perplexityUrl,
        agentEnabled: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
        geminiDeepResearch,
      },
    });

    respond(res, 200, {
      status: 'completed',
      perplexity: result.perplexity,
      deep_research: result.deepResearch,
      deep_research_error: result.deepResearchError,
      agent: result.agent,
      agent_error: result.agentError,
    });
  } catch (error) {
    if (error instanceof PipelineInputError) {
      respond(res, 400, { error: error.message });
      return;
    }

    if (error instanceof PipelineConfigurationError) {
      respond(res, 500, { error: error.message });
      return;
    }

    if (error instanceof PipelineRuntimeError) {
      respond(res, 502, { error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    respond(res, 500, { error: message });
  }
}
