import { useMemo, useState } from "react";
import Header from './components/Header';
import ResearchForm from './components/ResearchForm';
import ResultsPanel from './components/ResultsPanel';
import {
  AgentWorkflowResult,
  DeepResearchResult,
  GlassStyle,
  PerplexityResult,
  ResearchResponse,
} from './types';

const writingAnimation = `
@keyframes writing {
  0% { width: 0; }
  100% { width: 100%; }
}

.writing-animation {
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid;
  animation: writing 1.5s steps(40, end) forwards,
            blink-caret 0.75s step-end infinite;
}

@keyframes blink-caret {
  from, to { border-color: transparent; }
  50% { border-color: #0078D2; }
}
`;

const colorAnimation = `
@keyframes colorTransition {
  0% { stroke: #0078D2; }
  25% { stroke: #ffffff; }
  50% { stroke: #8A1C33; }
  75% { stroke: #d9d9d9; }
  100% { stroke: #0078D2; }
}

.animate-colors {
  animation: colorTransition 8s ease-in-out infinite;
  animation-fill-mode: forwards;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loader-icon {
  transition: stroke 1s ease-in-out;
}
`;

if (typeof document !== 'undefined') {
  const writingStyle = document.createElement('style');
  writingStyle.textContent = writingAnimation;
  document.head.appendChild(writingStyle);

  const colorStyle = document.createElement('style');
  colorStyle.textContent = colorAnimation;
  document.head.appendChild(colorStyle);

  const dmSansStyle = document.createElement('style');
  dmSansStyle.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
    body { font-family: 'DM Sans', sans-serif; }
  `;
  document.head.appendChild(dmSansStyle);
}

const API_ROUTE = '/api/research/perplexity';

function App() {
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perplexityResult, setPerplexityResult] = useState<PerplexityResult | null>(null);
  const [deepResearchResult, setDeepResearchResult] = useState<DeepResearchResult | null>(null);
  const [deepResearchError, setDeepResearchError] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentWorkflowResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const glassStyle: GlassStyle = useMemo(() => ({
    base: 'glass border border-white/10 bg-white/10 backdrop-blur-xl',
    card: 'glass relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 px-8 py-10 shadow-[var(--equilibrium-shadow)]',
    input: 'glass w-full rounded-xl border border-white/15 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#0078D2]/60 focus:border-transparent transition-all'
  }), []);

  const loaderColor = '#0078D2';

  const handleSubmit = async (formData: { companyName: string; companyUrl: string; companyHq: string; companyIndustry: string; }) => {
    if (!formData.companyName) {
      return;
    }

    setIsResearching(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: formData.companyName,
          topic: 'marketing positioning narrative for Ole Miss Finance Club pitch',
          industry: formData.companyIndustry || undefined,
          hq_location: formData.companyHq || undefined,
          focus: ['company profile', 'governance', 'finance club narrative'],
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'Research request failed.');
      }

      const data = (await response.json()) as ResearchResponse;
      setPerplexityResult(data.perplexity);
      setDeepResearchResult(data.deep_research);
      setDeepResearchError(data.deep_research_error);
      setAgentResult(data.agent);
      setAgentError(data.agent_error);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unknown error occurred.';
      setError(message);
      setPerplexityResult(null);
      setDeepResearchResult(null);
      setDeepResearchError(null);
      setAgentResult(null);
      setAgentError(null);
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,120,210,0.28),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(138,28,51,0.35),_transparent_60%),#050b16] pb-20 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pt-10 md:px-6">
        <Header glassStyle={glassStyle.card} title="PitchGuard: Ole Miss Finance Club" />
        <ResearchForm onSubmit={handleSubmit} isResearching={isResearching} glassStyle={glassStyle} loaderColor={loaderColor} />
        <ResultsPanel
          isLoading={isResearching}
          error={error}
          result={perplexityResult}
          deepResearch={deepResearchResult}
          deepResearchError={deepResearchError}
          agentResult={agentResult}
          agentError={agentError}
          glassStyle={glassStyle}
        />
      </div>
    </div>
  );
}

export default App;
