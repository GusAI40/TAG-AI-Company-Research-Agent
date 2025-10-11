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
      className={`${glassClass} relative overflow-hidden border border-white/15 bg-white/10 px-8 py-8 text-white shadow-[0_20px_45px_rgba(0,0,0,0.35)]`}
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#0078D2]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-[#8A1C33]/40 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Peeking under the hood</span>
          <h3 className="text-2xl font-semibold text-white">PitchGuard is orchestrating your hero briefing</h3>
          <p className="max-w-xl text-sm text-white/70">
            Watch the pipeline light up as each specialist agent feeds the final insight pack. Stay with it—your deck is about to
            get sharper.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {phases.map((phase, index) => {
            const isActive = index === activeIndex;
            return (
              <article
                key={phase.label}
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 transition duration-500 ${
                  isActive ? 'shadow-[0_12px_30px_rgba(0,120,210,0.35)]' : 'opacity-70'
                }`}
              >
                <div
                  className={`h-1 w-full rounded-full bg-gradient-to-r from-[#0078D2] to-[#8A1C33] transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-30'
                  }`}
                />
                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/60">{phase.label}</p>
                <h4 className="mt-2 text-lg font-semibold text-white">{phase.headline}</h4>
                <p className="mt-2 text-sm text-white/70">{phase.body}</p>
                {isActive && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-[#79C1FF]">
                    <span className="h-2 w-2 animate-ping rounded-full bg-[#79C1FF]" />
                    <span>Live</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-[#0B1831]/70 p-4">
          <p className="text-sm text-white/70">
            Tip: jot down fresh diligence questions while we gather the data—PitchGuard will surface source links for every
            insight moments from now.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearchLoadingExperience;
