import React from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { AgentWorkflowResult, GlassStyle, PerplexityResult, ReActStep } from '../types';

const sanitizeUrl = (candidate: string): string | null => {
  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate
    .trim()
    .replace(/^[(<\[]+/, '')
    .replace(/[)>.,;:'"\]]+$/g, '');

  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.href;
  } catch (error) {
    return null;
  }
};

const deriveLabel = (url: string, title: string | undefined, index: number): string => {
  if (title) {
    const trimmed = title.trim();
    if (trimmed.length > 0) {
      return trimmed.length > 64 ? `${trimmed.slice(0, 61)}…` : trimmed;
    }
  }

  try {
    const { hostname } = new URL(url);
    const cleanHost = hostname.replace(/^www\./i, '');
    if (cleanHost) {
      return cleanHost;
    }
  } catch (error) {
    // ignore hostname parsing errors
  }

  return `Source ${index + 1}`;
};

const normaliseSourceLinks = (
  raw: string,
  results: PerplexityResult['results'],
): Array<{ url: string; label: string }> => {
  if (!raw) {
    return [];
  }

  const links = new Map<string, string | undefined>();
  const urlMatches = raw.match(/https?:\/\/[^\s)]+/gi) ?? [];

  urlMatches.forEach((match) => {
    const clean = sanitizeUrl(match);
    if (clean) {
      links.set(clean, undefined);
    }
  });

  if (links.size === 0) {
    const indexMatches = [...raw.matchAll(/#(\d+)/g)];
    indexMatches.forEach((match) => {
      const index = Number.parseInt(match[1], 10);
      if (Number.isInteger(index) && index > 0 && index <= results.length) {
        const candidate = results[index - 1];
        if (candidate?.url) {
          const clean = sanitizeUrl(candidate.url);
          if (clean) {
            links.set(clean, candidate.title);
          }
        }
      }
    });
  }

  if (links.size === 0) {
    const numericMatches = [...raw.matchAll(/\b(\d{1,2})\b/g)];
    numericMatches.forEach((match) => {
      const index = Number.parseInt(match[1], 10);
      if (Number.isInteger(index) && index > 0 && index <= results.length) {
        const candidate = results[index - 1];
        if (candidate?.url) {
          const clean = sanitizeUrl(candidate.url);
          if (clean) {
            links.set(clean, candidate.title);
          }
        }
      }
    });
  }

  return Array.from(links.entries()).map(([url, title], idx) => ({
    url,
    label: deriveLabel(url, title, idx),
  }));
};

const SourceLinks: React.FC<{
  source: string;
  results: PerplexityResult['results'];
}> = ({ source, results }) => {
  const links = React.useMemo(() => normaliseSourceLinks(source, results), [source, results]);

  if (links.length === 0) {
    if (!source) {
      return null;
    }

    const trimmed = source.trim();
    const display = trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;

    return (
      <p className="mt-2 text-xs text-[#79C1FF]" title={trimmed}>
        Source: <span className="break-words">{display}</span>
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      {links.map((link, index) => (
        <a
          key={`${link.url}-${index}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[#79C1FF] transition hover:bg-white/20"
        >
          <span>{link.label}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
};

interface ResultsPanelProps {
  isLoading: boolean;
  error: string | null;
  result: PerplexityResult | null;
  agentResult: AgentWorkflowResult | null;
  agentError: string | null;
  glassStyle: GlassStyle;
}

const renderTrace = (title: string, steps: ReActStep[]) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <details className="group rounded-2xl border border-white/10 bg-white/5/10 p-5 text-white/80">
      <summary className="cursor-pointer select-none text-lg font-semibold text-white/80 outline-none transition group-open:text-white">
        {title}
      </summary>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li
            key={`${title}-${index}-${step.action}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.35em] text-white/50">Step {index + 1}</span>
              <span className="rounded-full bg-[#0078D2]/20 px-3 py-1 text-xs font-medium text-[#79C1FF]">
                {step.action}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/90">
              <span className="font-semibold text-white/70">Thought:</span> {step.thought}
            </p>
            <p className="mt-2 text-sm text-white/90">
              <span className="font-semibold text-white/70">Observation:</span> {step.observation}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({
  isLoading,
  error,
  result,
  agentResult,
  agentError,
  glassStyle,
}) => {
  return (
    <section className="equilibrium-section">
      <div className={`${glassStyle.card} equilibrium-panel space-y-8`}>
        <header className="space-y-2">
          <span className="equilibrium-badge text-xs uppercase tracking-[0.3em] text-white/60">Perplexity • OpenAI Agents</span>
          <h2 className="text-3xl font-semibold text-white">Hero Briefing</h2>
          <p className="text-white/60 max-w-2xl">
            PitchGuard fuses Perplexity’s newest search with an OpenAI agentic brain to deliver a brilliant, cited snapshot in seconds.
          </p>
          <p className="text-white/70 max-w-2xl">
            Drop this into your deck and your clients feel unstoppable—because you brought the effortless clarity that wins the room.
          </p>
        </header>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5/20 px-6 py-6 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-base">Crafting your hero briefing…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#8A1C33]/60 bg-[#8A1C33]/20 px-6 py-6 text-white">
            <h3 className="text-lg font-semibold">We hit a snag</h3>
            <p className="mt-2 text-white/80">{error}</p>
            <p className="mt-4 text-sm text-white/60">
              Confirm your Perplexity and OpenAI keys are set, then relaunch PitchGuard.
            </p>
          </div>
        )}

        {!isLoading && !error && !result && (
          <div className="rounded-2xl border border-white/10 bg-white/5/20 px-6 py-6 text-white/70">
            <p>
              Enter a company to get an instantly readable briefing, complete with clean citations and a ready-to-share profile.
            </p>
          </div>
        )}

        {result && !error && (
          <div className="space-y-8">
            {result.answer && (
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold text-white">Perplexity spotlight</h3>
                <p className="leading-relaxed text-white/80 whitespace-pre-line">{result.answer}</p>
              </div>
            )}

            {agentError && (
              <div className="rounded-2xl border border-[#8A1C33]/60 bg-[#8A1C33]/20 px-6 py-6 text-white">
                <h3 className="text-lg font-semibold">Agent unavailable</h3>
                <p className="mt-2 text-white/80">{agentError}</p>
                <p className="mt-4 text-sm text-white/60">
                  Perplexity results are still complete—relaunch after updating your AI keys to re-enable agent summaries.
                </p>
              </div>
            )}

            {agentResult && (() => {
              const scoreboardSections =
                agentResult.summary.scoreboard.length > 0
                  ? agentResult.summary.scoreboard
                  : agentResult.metric_sections;

              const diligenceSet =
                agentResult.summary.diligence_questions.length > 0
                  ? agentResult.summary.diligence_questions
                  : agentResult.diligence_questions;

              return (
                <div className="space-y-8">
                  <div className="rounded-3xl border border-white/10 bg-white/5/10 p-6 md:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.35em] text-white/50">Company</span>
                        <h3 className="text-3xl font-semibold text-white">
                          {agentResult.profile.company_name}
                          {agentResult.profile.ticker ? ` (${agentResult.profile.ticker})` : ''}
                        </h3>
                        <p className="max-w-xl text-white/70">{agentResult.profile.summary_hook}</p>
                      </div>
                      <div className="grid gap-3 text-sm text-white/70 md:text-right">
                        <div>
                          <span className="font-semibold text-white">Industry:</span> {agentResult.profile.industry}
                        </div>
                        <div>
                          <span className="font-semibold text-white">Headquarters:</span>{' '}
                          {agentResult.profile.headquarters_location}
                        </div>
                        <div>
                          <span className="font-semibold text-white">Latest filing:</span>{' '}
                          {agentResult.profile.latest_filing}
                        </div>
                        <div>
                          <span className="font-semibold text-white">Fiscal period:</span>{' '}
                          {agentResult.profile.fiscal_period}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-[#0B1831]/60 p-6">
                      <p className="text-sm uppercase tracking-[0.35em] text-[#79C1FF]">Hero briefing</p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        {agentResult.summary.hero_headline}
                      </p>
                      <p className="mt-3 text-white/70">{agentResult.summary.hero_subheadline}</p>
                    </div>
                  </div>

                  {agentResult.summary.quick_stats.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-white">Quick stats</h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {agentResult.summary.quick_stats.map((stat) => (
                          <article
                            key={`${stat.label}-${stat.value}`}
                            className="rounded-2xl border border-white/10 bg-white/5/10 p-5"
                          >
                            <p className="text-xs uppercase tracking-[0.35em] text-white/50">{stat.label}</p>
                            <p className="mt-2 text-xl font-semibold text-white">{stat.value}</p>
                            <SourceLinks source={stat.source} results={result.results} />
                            {stat.note && <p className="mt-2 text-sm text-white/70">{stat.note}</p>}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {agentResult.summary.key_takeaways.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-white">Key takeaways</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {agentResult.summary.key_takeaways.map((item) => (
                          <article
                            key={item.title}
                            className="rounded-2xl border border-white/10 bg-white/5/10 p-5"
                          >
                            <p className="text-xs uppercase tracking-[0.35em] text-white/50">{item.title}</p>
                            <p className="mt-2 text-white/80">{item.detail}</p>
                            <SourceLinks source={item.source} results={result.results} />
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {scoreboardSections.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-semibold text-white">Scoreboard</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {scoreboardSections.map((section) => (
                          <article
                            key={section.title}
                            className="rounded-2xl border border-white/10 bg-white/5/10 p-5"
                          >
                            <header className="flex items-center justify-between">
                              <h4 className="text-lg font-semibold text-white">{section.title}</h4>
                            </header>
                            <ul className="mt-4 space-y-3">
                              {section.metrics.map((metric) => (
                                <li key={`${section.title}-${metric.label}`} className="text-sm text-white/80">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <span className="font-medium text-white">{metric.label}</span>
                                    <span className="text-white/70">{metric.value}</span>
                                  </div>
                                  <SourceLinks source={metric.source} results={result.results} />
                                  {(metric.period || metric.trend || metric.note) && (
                                    <p className="mt-1 text-xs text-white/60">
                                      {[metric.period, metric.trend, metric.note]
                                        .filter(Boolean)
                                        .join(' • ')}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {agentResult.watch_items.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-white">Watch list</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {agentResult.watch_items.map((item) => (
                          <article
                            key={item.title}
                            className="rounded-2xl border border-white/10 bg-white/5/10 p-5"
                          >
                            <p className="text-xs uppercase tracking-[0.35em] text-[#FFB4C4]">{item.title}</p>
                            <p className="mt-2 text-white/80">{item.detail}</p>
                            <SourceLinks source={item.source} results={result.results} />
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {diligenceSet.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-white">Diligence questions</h3>
                      <ul className="space-y-3">
                        {diligenceSet.map((item, index) => (
                          <li
                            key={`${item.question}-${index}`}
                            className="rounded-2xl border border-white/10 bg-white/5/10 p-5 text-white/80"
                          >
                            <p className="font-semibold text-white">{item.question}</p>
                            <p className="mt-1 text-sm text-white/70">{item.why_it_matters}</p>
                            <SourceLinks source={item.source} results={result.results} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {agentResult.summary.next_actions.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-white">Next actions</h3>
                      <ul className="grid gap-3 md:grid-cols-2">
                        {agentResult.summary.next_actions.map((action) => (
                          <li
                            key={action}
                            className="rounded-2xl border border-white/10 bg-white/5/10 p-4 text-sm text-white/80"
                          >
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

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
