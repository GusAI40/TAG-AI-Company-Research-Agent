import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ResearchQueriesProps } from '../types';

const ResearchQueries: React.FC<ResearchQueriesProps> = ({
  queries,
  streamingQueries,
  isExpanded,
  onToggleExpand,
  isResetting,
  glassStyle
}) => {
  const fadeInAnimation = "transition-all duration-300 ease-in-out";

  return (
    <div
      className={`${glassStyle} equilibrium-panel ${fadeInAnimation} ${isResetting ? 'opacity-0 transform -translate-y-4' : 'opacity-100 transform translate-y-0'} font-['DM_Sans']`}
    >
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
      >
        <h2 className="text-xl font-semibold text-white">
          Generated Research Queries
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
        isExpanded ? 'mt-4 max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['company', 'industry', 'financial', 'news'].map((category) => (
            <div key={category} className={`equilibrium-subpanel p-4`}>
              <h3 className="text-base font-medium text-white mb-3 capitalize">
                {category.charAt(0).toUpperCase() + category.slice(1)} Queries
              </h3>
              <div className="space-y-2">
                {/* Show streaming queries first */}
                {Object.entries(streamingQueries)
                  .filter(([key]) => key.startsWith(category))
                  .map(([key, query]) => (
                    <div key={key} className="equilibrium-chip w-full justify-between border-[#0078D2]/35 bg-[#0078D2]/15 px-4 py-3 stream-fade">
                      <span className="text-[#D9D9D9] text-sm">{query.text}</span>
                      <span className="animate-pulse ml-3 text-[#79C1FF]">|</span>
                    </div>
                  ))}
                {/* Then show completed queries */}
                {queries
                  .filter((q) => q.category.startsWith(category))
                  .map((query, idx) => (
                    <div key={idx} className="equilibrium-chip w-full justify-start border-white/15 bg-white/10 px-4 py-3 stream-fade">
                      <span className="text-[#D9D9D9] text-sm">{query.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isExpanded && (
        <div className="mt-2 text-sm text-[#D9D9D9]">
          {queries.length} queries generated across {['company', 'industry', 'financial', 'news'].length} categories
        </div>
      )}
    </div>
  );
};

export default ResearchQueries; 