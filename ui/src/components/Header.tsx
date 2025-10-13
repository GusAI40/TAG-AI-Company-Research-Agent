import React, { useMemo, useState, useEffect } from 'react';
import useTypedText from '../hooks/useTypedText';

interface HeaderProps {
  glassStyle: string;
  title?: string;
}

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const saved = localStorage.getItem('theme');
    let resolved: 'dark' | 'light';

    if (saved === 'light' || saved === 'dark') {
      resolved = saved;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = prefersDark ? 'dark' : 'light';
    }

    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.remove('dark');
    }

    return resolved;
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
};

const heroMessages = [
  'Spot hidden risks before they reach the room.',
  'Surface KPIs that give every analyst an instant edge.',
  'Turn any stock pitch into a confident, evidence-backed story.',
];

const heroSignals = [
  { icon: '⚡️', label: 'Instant KPI snapshot' },
  { icon: '🛡️', label: 'Governance watchlist cues' },
  { icon: '🧭', label: 'Diligence prompts that drive debate' },
  { icon: '📈', label: 'YoY trends in a single glance' },
];

const Header: React.FC<HeaderProps> = ({ glassStyle, title = 'Company Research Agent' }) => {
  const { text: typedMessage, stage } = useTypedText(heroMessages, {
    typingSpeed: 36,
    deletingSpeed: 24,
    holdDuration: 2600,
  });

  const animatedSignals = useMemo(
    () =>
      heroSignals.map((signal, index) => ({
        ...signal,
        delay: `${index * 0.12}s`,
      })),
    []
  );

  return (
    <header className="equilibrium-header">
      <div className="equilibrium-header__actions">
        <ThemeToggle />
      </div>
      <span className="equilibrium-badge">PitchGuard • Ole Miss Finance Club</span>
      <h1 className="equilibrium-title">{title}</h1>
      <p className="equilibrium-subtext equilibrium-subtext--animated" aria-live="polite">
        <span className="hero-typed" data-stage={stage}>
          {typedMessage}
          <span className="hero-caret" aria-hidden="true" />
        </span>
      </p>
      <ul className="hero-signal-list" aria-hidden="true">
        {animatedSignals.map((signal) => (
          <li
            key={signal.label}
            className="hero-signal"
            style={{ animationDelay: signal.delay }}
          >
            <span className="hero-signal__icon" role="presentation">
              {signal.icon}
            </span>
            <span className="hero-signal__label">{signal.label}</span>
          </li>
        ))}
      </ul>
      <div className="equilibrium-divider" />
    </header>
  );
};

export default Header;
