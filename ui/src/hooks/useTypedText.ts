import { useEffect, useMemo, useState } from 'react';

type TypedStage = 'typing' | 'holding' | 'deleting';

interface UseTypedTextOptions {
  typingSpeed?: number;
  deletingSpeed?: number;
  holdDuration?: number;
}

interface TypedTextState {
  text: string;
  stage: TypedStage;
}

const DEFAULT_MESSAGES = [''];

export function useTypedText(
  messages: string[] | undefined,
  options: UseTypedTextOptions = {}
): TypedTextState {
  const { typingSpeed = 42, deletingSpeed = 28, holdDuration = 2200 } = options;

  const phrases = useMemo(() => {
    if (!messages || messages.length === 0) {
      return DEFAULT_MESSAGES;
    }
    return messages.filter(Boolean);
  }, [messages]);

  const [messageIndex, setMessageIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentMessage = phrases[messageIndex] ?? '';

    if (currentMessage.length === 0) {
      setDisplayText('');
      return;
    }

    if (!isDeleting && displayText === currentMessage) {
      const holdTimer = window.setTimeout(() => {
        setIsDeleting(true);
      }, holdDuration);
      return () => window.clearTimeout(holdTimer);
    }

    if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setMessageIndex((prev) => (prev + 1) % phrases.length);
      return;
    }

    const interval = window.setTimeout(() => {
      const delta = isDeleting ? -1 : 1;
      const nextLength = Math.max(0, Math.min(displayText.length + delta, currentMessage.length));
      setDisplayText(currentMessage.slice(0, nextLength));
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => window.clearTimeout(interval);
  }, [phrases, messageIndex, displayText, isDeleting, typingSpeed, deletingSpeed, holdDuration]);

  let stage: TypedStage = 'typing';
  const current = phrases[messageIndex] ?? '';
  if (displayText === current && !isDeleting) {
    stage = 'holding';
  } else if (isDeleting) {
    stage = 'deleting';
  }

  return { text: displayText, stage };
}

export default useTypedText;
