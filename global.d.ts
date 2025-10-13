declare const process: {
  env: Record<string, string | undefined>;
};

declare module 'ai' {
  export type StreamTextMessage = {
    role: string;
    content: string;
  };

  export type StreamTextResult = {
    toAIStreamResponse: () => Response;
  };

  export type StreamTextOptions = {
    model: unknown;
    messages: StreamTextMessage[];
  };

  export function streamText(options: StreamTextOptions): Promise<StreamTextResult>;
}

declare module '@ai-sdk/openai' {
  export type OpenAIClient = (model: string) => unknown;
  export type OpenAIConfig = {
    apiKey: string;
    baseURL?: string;
    organization?: string;
    project?: string;
  };

  export function createOpenAI(config: OpenAIConfig): OpenAIClient;
}
