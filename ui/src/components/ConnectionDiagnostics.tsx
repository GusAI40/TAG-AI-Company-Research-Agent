import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ConnectionDiagnosticsProps } from '../types';

const formatStatusLabel = (status?: number, error?: string) => {
  if (typeof status === 'number') {
    if (status === 401) {
      return 'Status 401 · Unauthorized';
    }
    if (status === 404) {
      return 'Status 404 · Not Found';
    }
    if (status >= 500) {
      return `Status ${status} · Server Error`;
    }
    return `Status ${status}`;
  }

  if (error) {
    return error;
  }

  return 'No response';
};

const formatTimestamp = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return '';
  }
};

const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  error,
  attempts,
  activeApiBase,
  activeWsBase,
  glassStyle,
}) => {
  if (!error) {
    return null;
  }

  const recentAttempts = attempts.slice(-4).reverse();
  const apiBaseDisplay = activeApiBase || '(relative origin)';
  const wsBaseDisplay = activeWsBase || '(relative origin)';

  return (
    <div className={`${glassStyle.card} equilibrium-panel equilibrium-panel--compact equilibrium-diagnostics font-['DM_Sans']`}>
      <div className="flex items-start gap-4">
        <div className="equilibrium-chip bg-[#8A1C33]/25 border-[#8A1C33]/40">
          <AlertTriangle className="h-5 w-5 text-[#FFD3DC]" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Connection troubleshooting</h3>
            <p className="text-xs text-[#D9D9D9] leading-relaxed">
              We attempted to reach the research service but received: <span className="text-[#FFD3DC]">{error}</span>
            </p>
          </div>

          <div className="grid gap-2 text-xs text-[#D9D9D9]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="uppercase tracking-wide text-[10px] text-[#D9D9D9]/70">Active API base</span>
              <code className="equilibrium-diagnostics__code">{apiBaseDisplay}</code>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="uppercase tracking-wide text-[10px] text-[#D9D9D9]/70">Active WS base</span>
              <code className="equilibrium-diagnostics__code">{wsBaseDisplay}</code>
            </div>
          </div>

          {recentAttempts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-[#D9D9D9]/70">Recent attempts</p>
              <ul className="space-y-2">
                {recentAttempts.map((attempt, index) => (
                  <li key={`${attempt.timestamp}-${index}`} className="text-xs text-[#D9D9D9]/90">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#D9D9D9]/60">
                      <span>{formatTimestamp(attempt.timestamp)}</span>
                      <span>{formatStatusLabel(attempt.status, attempt.error)}</span>
                    </div>
                    <code className="equilibrium-diagnostics__code block break-all mt-1">{attempt.url}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-[#D9D9D9]/70">Next steps</p>
            <ul className="list-disc pl-4 space-y-1 text-xs text-[#D9D9D9]/90">
              <li>
                Confirm <code className="equilibrium-diagnostics__code">VITE_API_URL</code> and <code className="equilibrium-diagnostics__code">VITE_WS_URL</code> point to an accessible backend (e.g. Fly.io deployment or local server).
              </li>
              <li>
                If your backend is behind preview protection or authentication, expose a public endpoint or deploy an accessible instance for this UI.
              </li>
              <li>
                For local testing run <code className="equilibrium-diagnostics__code">uvicorn application:app --reload --port 8000</code> and set <code className="equilibrium-diagnostics__code">VITE_API_URL=http://localhost:8000</code>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDiagnostics;
