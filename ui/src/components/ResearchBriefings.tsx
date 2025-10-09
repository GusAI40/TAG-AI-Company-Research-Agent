import React from 'react';
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

type BriefingStatus = {
  company: boolean;
  industry: boolean;
  financial: boolean;
  news: boolean;
};

interface ResearchBriefingsProps {
  briefingStatus: BriefingStatus;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isResetting: boolean;
}

const ResearchBriefings: React.FC<ResearchBriefingsProps> = ({
  briefingStatus,
  isExpanded,
  onToggleExpand,
  isResetting
}) => {
  const glassStyle = "backdrop-filter backdrop-blur-2xl bg-white/10 border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.45)] text-white";
  const cardGlassStyle = "backdrop-filter backdrop-blur-xl bg-white/10 shadow-sm text-white";

  return (
    <div 
      className={`${glassStyle} rounded-2xl p-6 transition-all duration-300 ease-in-out ${
        isResetting ? 'opacity-0 transform -translate-y-4' : 'opacity-100 transform translate-y-0'
      } font-['DM_Sans']`}
    >
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
      >
        <h2 className="text-xl font-semibold text-white">
          Research Briefings
        </h2>
        <button className="text-[#D9D9D9] hover:text-white transition-colors">
          {isExpanded ? (
            <ChevronUp className="h-6 w-6" />
          ) : (
            <ChevronDown className="h-6 w-6" />
          )}
        </button>
      </div>

      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
        isExpanded ? 'mt-6 max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-1">
          {['company', 'industry', 'financial', 'news'].map((category) => (
            <div 
              key={category} 
              className={`${cardGlassStyle} rounded-lg p-4 transition-all duration-500 ease-in-out relative ${
                briefingStatus[category as keyof BriefingStatus]
                  ? 'border border-[#0078D2] bg-gradient-to-br from-[#0078D2]/20 to-transparent shadow-md'
                  : 'border border-white/15 bg-white/5 hover:border-white/30 hover:shadow-sm'
              } backdrop-blur-sm group`}
            >
              {/* Background decoration element (only visible when active) */}
              <div 
                className={`absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,120,210,0.3),transparent_70%)] opacity-0 transition-opacity duration-700 ease-in-out rounded-lg ${
                  briefingStatus[category as keyof BriefingStatus] ? 'opacity-100' : ''
                }`}
                style={{ pointerEvents: 'none' }}
              />

              <div className="relative z-10 flex items-center justify-between">
                <h3 className={`text-sm font-medium capitalize transition-all duration-500 ${
                  briefingStatus[category as keyof BriefingStatus]
                    ? 'text-[#79C1FF]'
                    : 'text-[#D9D9D9] group-hover:text-white'
                }`}>{category}</h3>
                {briefingStatus[category as keyof BriefingStatus] ? (
                  <CheckCircle2 className="h-4 w-4 text-[#79C1FF] transition-all duration-300" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-white/20 group-hover:border-white/40 transition-all duration-300"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isExpanded && (
        <div className="mt-2 text-sm text-[#D9D9D9]">
          {Object.values(briefingStatus).filter(Boolean).length} of {Object.keys(briefingStatus).length} briefings completed
        </div>
      )}
    </div>
  );
};

export default ResearchBriefings; 