interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'ai/react' {
  import type { ChangeEvent, FormEvent } from 'react';

  export type ChatMessage = {
    id: string;
    role: string;
    content: string;
  };

  export type UseChatOptions = {
    api: string;
    headers?: Record<string, string>;
    initialMessages?: ChatMessage[];
  };

  export type UseChatResult = {
    messages: ChatMessage[];
    input: string;
    isLoading: boolean;
    error?: Error;
    handleInputChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
    setInput: (value: string) => void;
    stop: () => void;
  };

  export function useChat(options: UseChatOptions): UseChatResult;
}
