import React, { useState, useEffect } from 'react';
import { Theme, ThemeContextProps } from '../context';

interface HeaderProps {
  glassStyle: string;
  title?: string;
}

const ThemeToggle = () => {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme ? savedTheme === 'dark' : prefersDark;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <button 
      onClick={toggleTheme}
      className="theme-toggle"
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
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

const Header: React.FC<HeaderProps> = ({ glassStyle, title = 'Company Research Agent' }) => {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Failed to load Tavily logo');
    console.log('Image path:', e.currentTarget.src);
    e.currentTarget.style.display = 'none';
  };

  return (
    <header className="equilibrium-header">
      <div className="equilibrium-header__actions">
        <ThemeToggle />
      </div>
      <span className="equilibrium-badge">PitchGuard • Ole Miss Finance Club</span>
      <h1 className="equilibrium-title">{title}</h1>
      <p className="equilibrium-subtext">
        AI-native risk intelligence for the Ole Miss Finance Club—streaming live diligence and hidden risk scoring in real time.
      </p>
      <div className="equilibrium-divider" />
    </header>
  );
};

export default Header; 