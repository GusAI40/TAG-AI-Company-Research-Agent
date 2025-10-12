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

const API_ROUTE = '/api/research/perplexity';

function App() {
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perplexityResult, setPerplexityResult] = useState<PerplexityResult | null>(null);
  const [deepResearchResult, setDeepResearchResult] = useState<DeepResearchResult | null>(null);
  const [deepResearchError, setDeepResearchError] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentWorkflowResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const glassStyle: GlassStyle = useMemo(
    () => ({
      base: 'glass backdrop-blur-xl shadow-[var(--equilibrium-shadow)]',
      card:
        'glass relative overflow-hidden rounded-3xl px-5 sm:px-8 py-8 sm:py-10 shadow-[var(--equilibrium-shadow)]',
      input:
        'glass w-full rounded-xl py-3 sm:py-4 pl-10 sm:pl-12 pr-4 text-base sm:text-lg placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#0078D2]/60 focus:border-transparent transition-all font-["DM_Sans"]',
    }),
    []
  );

  const handleSubmit = async (formData: { companyName: string; companyUrl: string; companyHq: string; companyIndustry: string; }) => {
    if (!formData.companyName || isResearching) {
      return;
    }

    setIsResearching(true);
    setError(null);
    setPerplexityResult(null);
    setDeepResearchResult(null);
    setDeepResearchError(null);
    setAgentResult(null);
    setAgentError(null);

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
    <div className="equilibrium-app">
      <div className="equilibrium-app__container">
        <Header glassStyle={glassStyle.card} title="PitchGuard: Ole Miss Finance Club" />
        <ResearchForm onSubmit={handleSubmit} isResearching={isResearching} glassStyle={glassStyle} />
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
