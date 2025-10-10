import { ZodTypeAny } from './zod';

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

export class Runner {
  constructor(public readonly options: RunnerOptions = {}) {}

  async run<Schema extends ZodTypeAny>(agent: Agent<Schema>, conversation: AgentInputItem[]): Promise<RunnerResult<Schema>> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const messages = normaliseMessages(agent, conversation);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
