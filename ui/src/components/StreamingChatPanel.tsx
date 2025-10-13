import { FormEvent, useMemo } from 'react';

import { useStreamingChat } from '../hooks/useStreamingChat';

import type { GlassStyle } from '../types';

type StreamingChatPanelProps = {
  glassStyle: GlassStyle;
};

const roleLabel: Record<string, string> = {
  user: 'You',
  assistant: 'PitchGuard',
  system: 'System',
};

const StreamingChatPanel = ({ glassStyle }: StreamingChatPanelProps) => {
  const headers = useMemo(() => ({ 'Content-Type': 'application/json' }), []);

  const { messages, input, isLoading, error, handleInputChange, handleSubmit, setInput, stop } =
    useStreamingChat({
      api: '/api/chat',
      headers,
    });

  const transcript = useMemo(
    () => messages.filter((message) => message.role !== 'system'),
    [messages]
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }
    await handleSubmit(event);
  };

  return (
    <div className={`${glassStyle.card} serverless-panel`}> 
      <header className="serverless-panel__header">
        <div>
          <h3>Streaming Pitch Assistant</h3>
          <p>Ask real-time follow-ups and watch tokens appear as the model thinks.</p>
        </div>
        {isLoading ? (
          <button type="button" className="serverless-button serverless-button--ghost" onClick={() => stop()}>
            Stop
          </button>
        ) : null}
      </header>

      <div className="streaming-chat__log" role="log" aria-live="polite">
        {transcript.length === 0 ? (
          <p className="equilibrium-text-muted">Try “Summarize the latest 10-K red flags.”</p>
        ) : (
          transcript.map((message) => (
            <div key={message.id} className={`streaming-chat__message streaming-chat__message--${message.role}`}>
              <span className="streaming-chat__message-role">{roleLabel[message.role] ?? message.role}</span>
              <p>{message.content}</p>
            </div>
          ))
        )}
      </div>

      <form className="streaming-chat__composer" onSubmit={onSubmit}>
        <label className="serverless-label" htmlFor="streaming-chat-input">
          Ask a question
        </label>
        <div className="streaming-chat__input-row">
          <input
            id="streaming-chat-input"
            className="serverless-input streaming-chat__input"
            value={input}
            onChange={handleInputChange}
            placeholder="Where is this company vulnerable?"
            autoComplete="off"
            disabled={isLoading}
          />
          <button type="submit" className="serverless-button" disabled={isLoading}>
            Send
          </button>
        </div>
      </form>

      <div className="streaming-chat__status">
        {isLoading ? <span className="streaming-chat__typing">PitchGuard is drafting…</span> : null}
        {error ? <span className="equilibrium-text-error">{error.message}</span> : null}
      </div>

      <footer className="streaming-chat__footer">
        <button
          type="button"
          className="serverless-button serverless-button--ghost"
          onClick={() => setInput('Explain the cash flow dynamics driving this pitch.')}
        >
          Quick prompt
        </button>
        <span className="equilibrium-text-muted">Powered by Vercel AI streaming</span>
      </footer>
    </div>
  );
};

export default StreamingChatPanel;
