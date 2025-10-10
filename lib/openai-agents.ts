import { ZodTypeAny } from './zod.js';

export type AgentInputContent = {
  type: 'input_text' | 'output_text';
  text: string;
};

export type AgentInputItem = {
  role: 'user' | 'assistant' | 'system';
  content: AgentInputContent[];
};

interface AgentModelSettings {
  reasoning?: {
    effort?: 'low' | 'medium' | 'high' | 'minimal';
  };
  store?: boolean;
}

export class Agent<Schema extends ZodTypeAny> {
  constructor(
    public readonly config: {
      name: string;
      instructions: string;
      model: string;
      outputType: Schema;
      modelSettings?: AgentModelSettings;
    }
  ) {}

  get name() {
    return this.config.name;
  }

  get instructions() {
    return this.config.instructions;
  }

  get model() {
    return this.config.model;
  }

  get outputType() {
    return this.config.outputType;
  }

  get modelSettings() {
    return this.config.modelSettings;
  }
}

export type RunnerResult<Schema extends ZodTypeAny> = {
  finalOutput?: Schema['_type'];
  newItems: Array<{ rawItem: AgentInputItem }>;
};

interface RunnerOptions {
  traceMetadata?: Record<string, unknown>;
}

const describeSchema = (schema: ZodTypeAny, indent = 0): string => {
  const pad = ' '.repeat(indent);
  if (typeof (schema as unknown as { getShape?: () => Record<string, ZodTypeAny> }).getShape === 'function') {
    const shape = (schema as unknown as { getShape: () => Record<string, ZodTypeAny> }).getShape();
    const inner = Object.entries(shape)
      .map(([key, value]) => `${pad}  "${key}": ${describeSchema(value, indent + 2)}`)
      .join(',\n');
    return `{"type":"object","properties":{\n${inner}\n${pad}}}`;
  }
  if (typeof (schema as unknown as { getInner?: () => ZodTypeAny }).getInner === 'function') {
    const inner = describeSchema((schema as unknown as { getInner: () => ZodTypeAny }).getInner(), indent + 2);
    return `{"type":"array","items":${inner}}`;
  }
  const descriptor = schema.describe();
  if (descriptor.includes('number')) {
    return '{"type":"number"}';
  }
  return '{"type":"string"}';
};

const normaliseMessages = (agent: Agent<ZodTypeAny>, conversation: AgentInputItem[]): Array<{ role: string; content: string }> => {
  const systemContent = `${agent.instructions}\n\nReturn ONLY valid JSON that strictly matches the schema below. Do not include extra prose.\n${describeSchema(agent.outputType)}`;

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemContent },
  ];

  for (const item of conversation) {
    const text = item.content.map((part) => part.text).join('\n\n');
    messages.push({ role: item.role, content: text });
  }

  return messages;
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

type AgentProvider = 'openai' | 'gemini';

type ProviderResolution = {
  provider: AgentProvider | null;
  reason?: string;
};

let inferredProjectId: string | null | undefined;
let cachedProviderResolution: ProviderResolution | null = null;

const fetchProjectIdFromOpenAI = async (apiKey: string): Promise<string> => {
  if (inferredProjectId) {
    return inferredProjectId;
  }

  const response = await fetch('https://api.openai.com/v1/projects', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const snippet = await response.text().catch(() => '');
    throw new Error(
      'Project-scoped keys (sk-proj-...) must set OPENAI_PROJECT_ID. ' +
        'Automatic detection failed: ' +
        snippet.slice(0, 200)
    );
  }

  const data = (await response.json()) as { data?: Array<{ id?: string }>; };
  const projectId = data.data?.find((entry) => typeof entry.id === 'string' && entry.id.startsWith('proj_'))?.id;

  if (!projectId) {
    throw new Error(
      'Project-scoped keys (sk-proj-...) must set OPENAI_PROJECT_ID. Unable to infer a proj_ identifier from the OpenAI API response.'
    );
  }

  inferredProjectId = projectId;
  return projectId;
};

const buildOpenAIHeaders = async (apiKey: string) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const orgId = process.env.OPENAI_ORG_ID;
  if (orgId) {
    headers['OpenAI-Organization'] = orgId;
  }

  if (apiKey.startsWith('sk-proj-')) {
    const envProjectId = process.env.OPENAI_PROJECT_ID?.trim();
    let projectId = envProjectId;

    if (projectId && !/^proj_[A-Za-z0-9]+$/.test(projectId)) {
      throw new Error(
        `OPENAI_PROJECT_ID must look like "proj_..." but received "${projectId}". Check the value in your environment.`
      );
    }

    if (!projectId) {
      projectId = await fetchProjectIdFromOpenAI(apiKey);
    }

    headers['OpenAI-Project'] = projectId;
  }

  return headers;
};

const ensureOpenAIReady = async (apiKey: string): Promise<{ ok: boolean; reason?: string }> => {
  if (apiKey.startsWith('sk-proj-')) {
    const envProjectId = process.env.OPENAI_PROJECT_ID?.trim();
    if (envProjectId) {
      if (!/^proj_[A-Za-z0-9]+$/.test(envProjectId)) {
        return {
          ok: false,
          reason: `OPENAI_PROJECT_ID must look like "proj_..." but received "${envProjectId}". Check the value in your environment.`,
        };
      }
      inferredProjectId = envProjectId;
      return { ok: true };
    }

    try {
      await fetchProjectIdFromOpenAI(apiKey);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Project-scoped keys (sk-proj-...) must set OPENAI_PROJECT_ID.';
      return { ok: false, reason: message };
    }
  }

  return { ok: true };
};

export const resolveAgentProvider = async (): Promise<ProviderResolution> => {
  if (cachedProviderResolution) {
    return cachedProviderResolution;
  }

  const configured = process.env.PITCHGUARD_AGENT_PROVIDER?.toLowerCase();
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  const ensureOpenAI = async (): Promise<ProviderResolution> => {
    if (!openAIKey) {
      return {
        provider: null,
        reason: 'OPENAI_API_KEY is not configured. Set it or provide GEMINI_API_KEY to enable the agent.',
      };
    }

    const readiness = await ensureOpenAIReady(openAIKey);
    if (!readiness.ok) {
      return { provider: null, reason: readiness.reason };
    }

    return { provider: 'openai' };
  };

  if (configured === 'openai') {
    cachedProviderResolution = await ensureOpenAI();
    return cachedProviderResolution;
  }

  if (configured === 'gemini') {
    if (!geminiKey) {
      cachedProviderResolution = {
        provider: null,
        reason: 'PITCHGUARD_AGENT_PROVIDER=gemini but GEMINI_API_KEY is not configured.',
      };
    } else {
      cachedProviderResolution = { provider: 'gemini' };
    }
    return cachedProviderResolution;
  }

  if (openAIKey) {
    const readiness = await ensureOpenAIReady(openAIKey);
    if (readiness.ok) {
      cachedProviderResolution = { provider: 'openai' };
      return cachedProviderResolution;
    }

    if (geminiKey) {
      cachedProviderResolution = { provider: 'gemini' };
      return cachedProviderResolution;
    }

    cachedProviderResolution = {
      provider: null,
      reason: readiness.reason ??
        'OPENAI_API_KEY is configured but missing a valid OPENAI_PROJECT_ID. Provide it or supply GEMINI_API_KEY to enable the agent.',
    };
    return cachedProviderResolution;
  }

  if (geminiKey) {
    cachedProviderResolution = { provider: 'gemini' };
    return cachedProviderResolution;
  }

  cachedProviderResolution = {
    provider: null,
    reason: 'No agent provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY to enable the agent.',
  };

  return cachedProviderResolution;
};

const mapModelToGemini = (model: string): string => {
  const override = process.env.GEMINI_AGENT_MODEL?.trim();
  if (override) {
    return override;
  }
  const lowered = model.toLowerCase();
  if (lowered.includes('mini') || lowered.includes('flash')) {
    return 'gemini-2.5-flash';
  }
  if (lowered.includes('pro')) {
    return 'gemini-2.5-pro';
  }
  return 'gemini-2.5-pro';
};

const callOpenAI = async <Schema extends ZodTypeAny>(
  agent: Agent<Schema>,
  conversation: AgentInputItem[]
): Promise<{ rawText: string }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const messages = normaliseMessages(agent, conversation);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: await buildOpenAIHeaders(apiKey),
    body: JSON.stringify({
      model: agent.model,
      temperature: 0,
      messages,
    }),
  });

  if (!response.ok) {
    const preview = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed with status ${response.status}: ${preview.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawText = data.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('OpenAI response did not contain any content.');
  }

  return { rawText };
};

type GeminiContent = {
  role: string;
  parts: Array<{ text: string }>;
};

const normaliseMessagesForGemini = (agent: Agent<ZodTypeAny>, conversation: AgentInputItem[]) => {
  const messages = normaliseMessages(agent, conversation);
  const system = messages.find((message) => message.role === 'system');
  const rest = messages.filter((message) => message.role !== 'system');

  const contents: GeminiContent[] = rest.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  return { system, contents };
};

const callGemini = async <Schema extends ZodTypeAny>(
  agent: Agent<Schema>,
  conversation: AgentInputItem[]
): Promise<{ rawText: string }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const { system, contents } = normaliseMessagesForGemini(agent, conversation);
  const model = mapModelToGemini(agent.model);

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: 0 },
  };

  if (system) {
    payload['system_instruction'] = {
      role: 'system',
      parts: [{ text: system.content }],
    };
  }

  const response = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const preview = await response.text().catch(() => '');
    if (response.status === 404) {
      const summary = preview.slice(0, 400);
      throw new Error([
        'Gemini 2.5 Pro Agent unavailable',
        `Gemini request failed with status 404: ${summary}`,
        'Perplexity results are still complete—relaunch after updating your AI keys to re-enable agent summaries.',
      ].join('\n'));
    }
    throw new Error(`Gemini request failed with status ${response.status}: ${preview.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parts = data.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const rawText = parts.map((part) => part.text ?? '').join('').trim();

  if (!rawText) {
    throw new Error('Gemini response did not contain any text.');
  }

  return { rawText };
};

export class Runner {
  constructor(public readonly options: RunnerOptions = {}) {}

  async run<Schema extends ZodTypeAny>(agent: Agent<Schema>, conversation: AgentInputItem[]): Promise<RunnerResult<Schema>> {
    const { provider, reason } = await resolveAgentProvider();

    if (!provider) {
      throw new Error(reason ?? 'No agent provider configured.');
    }

    const { rawText } = provider === 'openai'
      ? await callOpenAI(agent, conversation)
      : await callGemini(agent, conversation);

    let parsed: Schema['_type'];
    try {
      parsed = agent.outputType.parse(JSON.parse(rawText));
    } catch (error) {
      throw new Error(`Failed to parse agent output: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      finalOutput: parsed,
      newItems: [
        {
          rawItem: {
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: rawText,
              },
            ],
          },
        },
      ],
    };
  }
}
