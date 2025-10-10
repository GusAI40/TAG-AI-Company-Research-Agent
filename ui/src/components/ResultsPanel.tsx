import React from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { AgentWorkflowResult, GlassStyle, PerplexityResult, ReActStep } from '../types';

interface ResultsPanelProps {
  isLoading: boolean;
  error: string | null;
  result: PerplexityResult | null;
  agentResult: AgentWorkflowResult | null;
  glassStyle: GlassStyle;
}

const renderTrace = (title: string, steps: ReActStep[]) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-semibold text-white">{title}</h3>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={`${title}-${index}-${step.action}`}
            className="rounded-2xl border border-white/10 bg-white/5/10 p-5 text-white/80"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm uppercase tracking-[0.35em] text-white/50">Step {index + 1}</span>
              <span className="rounded-full bg-[#0078D2]/20 px-3 py-1 text-xs font-medium text-[#79C1FF]">
                {step.action}
              </span>
            </div>
            <p className="mt-3 text-white/90">
              <span className="font-semibold text-white/70">Thought:</span> {step.thought}
            </p>
            <p className="mt-2 text-white/90">
              <span className="font-semibold text-white/70">Observation:</span> {step.observation}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ isLoading, error, result, agentResult, glassStyle }) => {
  return (
    <section className="equilibrium-section">
      <div className={`${glassStyle.card} equilibrium-panel space-y-8`}>
        <header className="space-y-2">
          <span className="equilibrium-badge text-xs uppercase tracking-[0.3em] text-white/60">Perplexity • OpenAI Agents</span>
          <h2 className="text-3xl font-semibold text-white">Research Highlights</h2>
          <p className="text-white/60 max-w-2xl">
            Your request is answered using Perplexity's latest search API and an agentic workflow that synthesises marketing-ready insights for the Ole Miss Finance Club.
          </p>
          <p className="text-white/70 max-w-2xl">
            Share these findings with your stakeholders to position them as the heroes who make disciplined, risk-aware decisions because you surfaced every hidden edge.
          </p>
        </header>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5/20 px-6 py-6 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-base">Running Perplexity research…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#8A1C33]/60 bg-[#8A1C33]/20 px-6 py-6 text-white">
            <h3 className="text-lg font-semibold">We hit a snag</h3>
            <p className="mt-2 text-white/80">{error}</p>
            <p className="mt-4 text-sm text-white/60">
              Confirm your Perplexity and OpenAI keys are configured, then run the research again.
            </p>
          </div>
        )}

        {!isLoading && !error && !result && (
          <div className="rounded-2xl border border-white/10 bg-white/5/20 px-6 py-6 text-white/70">
            <p>
              Submit a company to receive a Perplexity-driven briefing with a summarised marketing profile and cited source links.
            </p>
          </div>
        )}

        {result && !error && (
          <div className="space-y-8">
            {result.answer && (
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold text-white">Perplexity synthesis</h3>
                <p className="leading-relaxed text-white/80 whitespace-pre-line">{result.answer}</p>
              </div>
            )}

            {agentResult && (
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-white">Agent marketing profile</h3>
                <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5/10 p-6">
                  <div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Company</span>
                    <p className="mt-1 text-lg font-semibold text-white">{agentResult.summary.company_name}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <span className="text-xs uppercase tracking-[0.35em] text-white/50">Industry</span>
                      <p className="mt-1 text-white/80">{agentResult.summary.industry}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-[0.35em] text-white/50">Headquarters</span>
                      <p className="mt-1 text-white/80">{agentResult.summary.headquarters_location}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-[0.35em] text-white/50">Company size</span>
                      <p className="mt-1 text-white/80">{agentResult.summary.company_size}</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-[0.35em] text-white/50">Founded</span>
                      <p className="mt-1 text-white/80">{agentResult.summary.founded_year}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Description</span>
                    <p className="mt-2 text-white/80 leading-relaxed">{agentResult.summary.description}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">Website</span>
                    <p className="mt-2">
                      <a
                        className="inline-flex items-center gap-1 text-[#79C1FF] transition hover:text-white"
                        href={agentResult.summary.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {agentResult.summary.website}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {agentResult && renderTrace('Research reasoning trace', agentResult.research_trace)}

            {agentResult && renderTrace('Narrative reasoning trace', agentResult.summary_trace)}

            {result.results.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-white">Source citations</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {result.results.map((source, index) => (
                    <article key={`${source.url}-${index}`} className="rounded-2xl border border-white/10 bg-white/5/10 p-5 transition hover:border-[#79C1FF]/60">
                      <p className="text-sm uppercase tracking-[0.35em] text-white/50">Source {index + 1}</p>
                      <h4 className="mt-2 text-lg font-semibold text-white">{source.title}</h4>
                      <p className="mt-2 text-sm text-white/70 leading-relaxed">{source.snippet}</p>
                      {source.url && (
                        <a
                          className="mt-3 inline-flex items-center gap-1 text-[#79C1FF] text-sm transition hover:text-white"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View source
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ResultsPanel;
