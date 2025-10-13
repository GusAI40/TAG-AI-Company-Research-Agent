import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from '../types';

type UseStreamingChatOptions = {
  api: string;
  headers?: Record<string, string>;
  initialMessages?: ChatMessage[];
};

type UseStreamingChatResult = {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  error: Error | null;
  handleInputChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  setInput: (value: string) => void;
  stop: () => void;
};

const extractText = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).join('');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') {
      return record.text;
    }
    if (typeof record.value === 'string') {
      return record.value;
    }
    if (Array.isArray(record.content)) {
      return extractText(record.content);
    }
    if ('content' in record) {
      return extractText(record.content);
    }
    if ('delta' in record) {
      return extractText(record.delta);
    }
    if ('data' in record) {
      return extractText(record.data);
    }
  }

  return '';
};

const resolveTextFromEvent = (event: Record<string, unknown>): string => {
  if ('delta' in event) {
    const deltaText = extractText(event.delta);
    if (deltaText) {
      return deltaText;
    }
  }

  if ('message' in event) {
    const message = event.message as Record<string, unknown>;
    if (message) {
      const contentText = extractText(message.content);
      if (contentText) {
        return contentText;
      }
      if (typeof message.text === 'string') {
        return message.text;
      }
    }
  }

  if ('response' in event) {
    const responseText = extractText(event.response);
    if (responseText) {
      return responseText;
    }
  }

  if ('content' in event) {
    const contentText = extractText(event.content);
    if (contentText) {
      return contentText;
    }
  }

  if ('data' in event) {
    const dataText = extractText(event.data);
    if (dataText) {
      return dataText;
    }
  }

  return '';
};

const resolveErrorMessage = (event: Record<string, unknown>): string | null => {
  const { error } = event;
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as Record<string, unknown>).message as string;
  }
  if ('message' in event && typeof event.message === 'string') {
    return event.message as string;
  }
  return null;
};

const createAssistantId = () => `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useStreamingChat(options: UseStreamingChatOptions): UseStreamingChatResult {
  const { api, headers = {}, initialMessages = [] } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const stableHeaders = useMemo(() => ({ ...headers }), [headers]);

  const updateAssistantMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, content } : message)));
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };

      appendMessage(userMessage);
      setInput('');
      setError(null);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      const conversation = [...messagesRef.current, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const assistantId = createAssistantId();
      appendMessage({ id: assistantId, role: 'assistant', content: '' });

      let accumulated = '';
      const decoder = new TextDecoder();

      try {
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...stableHeaders,
          },
          body: JSON.stringify({ messages: conversation }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = `Request failed with status ${response.status}`;
          try {
            const payload = await response.json();
            if (payload && typeof payload.error === 'string') {
              message = payload.error;
            }
          } catch (jsonError) {
            // ignore JSON parsing errors, fall back to default message
          }
          throw new Error(message);
        }

        const reader = response.body.getReader();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');

            const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data:'));
            if (!dataLine) {
              continue;
            }

            const payload = dataLine.slice(5).trim();
            if (!payload || payload === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              const type = typeof parsed.type === 'string' ? parsed.type : '';

              if (type === 'response.error' || type === 'error') {
                const message = resolveErrorMessage(parsed) ?? 'The model returned an error.';
                throw new Error(message);
              }

              const fragment = resolveTextFromEvent(parsed);
              if (fragment) {
                accumulated += fragment;
                updateAssistantMessage(assistantId, accumulated);
              }
            } catch (streamError) {
              if (streamError instanceof Error) {
                throw streamError;
              }
            }
          }
        }

        if (buffer.trim().length > 0) {
          const dataLine = buffer.split('\n').find((line) => line.startsWith('data:'));
          if (dataLine) {
            const payload = dataLine.slice(5).trim();
            if (payload && payload !== '[DONE]') {
              try {
                const parsed = JSON.parse(payload) as Record<string, unknown>;
                const type = typeof parsed.type === 'string' ? parsed.type : '';
                if (type === 'response.error' || type === 'error') {
                  const message = resolveErrorMessage(parsed) ?? 'The model returned an error.';
                  throw new Error(message);
                }
                const fragment = resolveTextFromEvent(parsed);
                if (fragment) {
                  accumulated += fragment;
                  updateAssistantMessage(assistantId, accumulated);
                }
              } catch (streamError) {
                if (streamError instanceof Error) {
                  throw streamError;
                }
              }
            }
          }
        }
      } catch (streamError) {
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          return;
        }

        const fallbackMessage =
          streamError instanceof Error ? streamError.message : 'Unable to generate a response.';
        setError(new Error(fallbackMessage));

        if (!accumulated) {
          setMessages((prev) => prev.filter((message) => message.id !== assistantId));
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [api, appendMessage, input, isLoading, stableHeaders, updateAssistantMessage]
  );

  return {
    messages,
    input,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
    setInput,
    stop,
  };
}

export default useStreamingChat;
