import React from 'react';
import { Loader2, Search, Sparkle } from 'lucide-react';
import { PerplexityFallbackProps } from '../types';

const PerplexityFallbackPanel: React.FC<PerplexityFallbackProps> = ({
  visible,
  isRunning,
  error,
  result,
  onRun,
  onReset,
  glassStyle,
}) => {
  if (!visible) {
    return null;
  }

  const hasResults = Boolean(result?.results?.length);

  return (
    <div className={`${glassStyle.card} equilibrium-panel equilibrium-panel--compact equilibrium-fallback font-['DM_Sans']`}> 
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="equilibrium-chip bg-[#0078D2]/25 border-[#0078D2]/40">
            <Search className="h-5 w-5 text-[#A8D8FF]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Perplexity quick scan fallback
              <Sparkle className="h-4 w-4 text-[#FFD3DC]" />
            </h3>
            <p className="text-xs text-[#D9D9D9]/90 leading-relaxed">
              When the primary research service is unreachable, you can trigger a direct Perplexity Search query to collect fast, citation-ready facts. We assemble a focused query based on your form inputs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="equilibrium-button equilibrium-button--primary flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkle className="h-4 w-4" />
            )}
            {isRunning ? 'Running Perplexity scan…' : 'Run Perplexity scan'}
          </button>
          {hasResults && (
            <button
              type="button"
              onClick={onReset}
              className="equilibrium-button equilibrium-button--ghost text-[#A8D8FF]"
            >
              Reset results
            </button>
          )}
        </div>

        {error && (
          <div className="equilibrium-card border border-[#8A1C33]/40 bg-[#8A1C33]/15 p-3 text-xs text-[#FFD3DC]">
            {error}
          </div>
        )}

        {hasResults && result && (
          <div className="space-y-3">
            {result.answer && (
              <div className="equilibrium-card bg-white/5 border border-white/10 p-4">
                <p className="text-xs uppercase tracking-widest text-[#D9D9D9]/60 mb-2">Synthesis</p>
                <p className="text-sm text-white leading-relaxed whitespace-pre-line">{result.answer}</p>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-[#D9D9D9]/60">Top sources</p>
              <ul className="space-y-2">
                {result.results.map((item, index) => (
                  <li key={`${item.url || index}-${index}`} className="equilibrium-card bg-white/3 border border-white/10 p-3">
                    <p className="text-sm text-white font-medium">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="text-[#A8D8FF] hover:text-white underline">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </p>
                    {item.snippet && (
                      <p className="text-xs text-[#D9D9D9]/80 mt-1 leading-relaxed">{item.snippet}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#D9D9D9]/60 mt-2">
                      {item.published_at && <span>Published: {item.published_at}</span>}
                      {typeof item.score === 'number' && <span>Score: {item.score.toFixed(2)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerplexityFallbackPanel;

