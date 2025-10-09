import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ResearchStatusProps } from '../types';

const ResearchStatus: React.FC<ResearchStatusProps> = ({
  status,
  error,
  isComplete,
  currentPhase,
  isResetting,
  glassStyle,
  loaderColor,
  statusRef
}) => {
  const glassCardStyle = `${glassStyle.base} rounded-2xl p-6`;
  const fadeInAnimation = "transition-all duration-300 ease-in-out";

  if (!status) return null;

  return (
    <div
      ref={statusRef}
      className={`${glassCardStyle} ${fadeInAnimation} ${isResetting ? 'opacity-0 transform -translate-y-4' : 'opacity-100 transform translate-y-0'} bg-white/10 border-white/15 font-['DM_Sans']`}
    >
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          {error ? (
            <div className={`${glassStyle.base} p-2 rounded-full bg-[#8A1C33]/20 border-[#8A1C33]/40`}>
              <XCircle className="h-5 w-5 text-[#FFD3DC]" />
            </div>
          ) : status?.step === "Complete" || isComplete ? (
            <div className={`${glassStyle.base} p-2 rounded-full bg-white/10 border-white/30`}>
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          ) : currentPhase === 'search' || currentPhase === 'enrichment' || (status?.step === "Processing" && status.message.includes("scraping")) ? (
            <div className={`${glassStyle.base} p-2 rounded-full bg-[#0078D2]/20 border-[#0078D2]/40`}>
              <Loader2 className="h-5 w-5 animate-spin loader-icon" style={{ stroke: loaderColor }} />
            </div>
          ) : currentPhase === 'briefing' ? (
            <div className={`${glassStyle.base} p-2 rounded-full bg-[#0078D2]/20 border-[#0078D2]/40`}>
              <Loader2 className="h-5 w-5 animate-spin loader-icon" style={{ stroke: loaderColor }} />
            </div>
          ) : (
            <div className={`${glassStyle.base} p-2 rounded-full bg-[#0078D2]/20 border-[#0078D2]/40`}>
              <Loader2 className="h-5 w-5 animate-spin loader-icon" style={{ stroke: loaderColor }} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-white stream-fade">{status.step}</p>
          <p className="text-sm text-[#D9D9D9] whitespace-pre-wrap stream-fade">
            {error || status.message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearchStatus; 