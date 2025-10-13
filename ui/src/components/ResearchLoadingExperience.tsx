import React from 'react';

interface ResearchLoadingExperienceProps {
  glassClass: string;
}

const ResearchLoadingExperience: React.FC<ResearchLoadingExperienceProps> = ({ glassClass }) => {
  const phases = React.useMemo(
    () => [
      {
        label: 'Scanning the field',
        headline: 'Perplexity scouts the open web',
        body: 'Pulling SEC filings, investor updates, and the freshest headlines to prime the briefing.',
      },
      {
        label: 'Deep research dive',
        headline: 'Gemini dissects the disclosures',
        body: 'Testing year-over-year moves, liquidity pressure points, and governance shifts for Ole Miss diligence.',
      },
      {
        label: 'Agentic synthesis',
        headline: 'PitchGuard composes the hero story',
        body: 'Aligning KPIs, watch items, and diligence prompts so you can cross-examine any stock pitch in the room.',
      },
    ],
    [],
  );

  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % phases.length);
    }, 2600);

    return () => window.clearInterval(id);
  }, [phases.length]);

  return (
    <div
      className={`${glassClass} relative overflow-hidden border border-white/15 bg-white/10 px-5 py-6 sm:px-8 sm:py-8 text-white shadow-[0_20px_45px_rgba(0,0,0,0.35)]`}
    >
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'color-mix(in srgb, var(--color-accent) 45%, transparent)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'color-mix(in srgb, var(--color-ember) 40%, transparent)' }}
      />

      <div className="relative flex flex-col gap-6">
        <div className="space-y-2">
          <span className="text-[0.65rem] uppercase tracking-[0.3em] text-white/60 sm:text-xs">Peeking under the hood</span>
          <h3 className="text-xl font-semibold text-white sm:text-2xl">PitchGuard is orchestrating your hero briefing</h3>
          <p className="max-w-xl text-sm text-white/70 sm:text-base">
            Watch the pipeline light up as each specialist agent feeds the final insight pack. Stay with it—your deck is about to
            get sharper.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {phases.map((phase, index) => {
            const isActive = index === activeIndex;
            return (
              <article
                key={phase.label}
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 transition duration-500 ${
                  isActive ? 'opacity-100' : 'opacity-70'
                }`}
                style={
                  isActive
                    ? { boxShadow: '0 12px 30px color-mix(in srgb, var(--color-accent) 35%, transparent)' }
                    : undefined
                }
              >
                <div
                  className={`h-1 w-full rounded-full transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-30'
                  }`}
                  style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-ember))' }}
                />
                <p className="mt-4 text-[0.65rem] uppercase tracking-[0.3em] text-white/60 sm:text-xs">{phase.label}</p>
                <h4 className="mt-2 text-base font-semibold text-white sm:text-lg">{phase.headline}</h4>
                <p className="mt-2 text-sm text-white/70 sm:text-base">{phase.body}</p>
                {isActive && (
                  <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--color-accent)' }}>
                    <span
                      className="h-2 w-2 animate-ping rounded-full"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    />
                    <span>Live</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div
          className="relative rounded-2xl border border-white/10 p-4"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)' }}
        >
          <p className="text-sm text-white/70 sm:text-base">
            Tip: jot down fresh diligence questions while we gather the data—PitchGuard will surface source links for every insight
            moments from now.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearchLoadingExperience;
