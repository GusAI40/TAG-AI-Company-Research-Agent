# PitchGuard Purpose & Value Narrative

## Why PitchGuard Exists
PitchGuard was created to protect student and early-career investors from hidden risks in stock pitches. Its mission is to democratize forensic-quality diligence so the Ole Miss Finance Club and partner communities can evaluate ideas with the same rigor as top-tier funds. The guiding worldview is "trust, but verify": every narrative should be grounded in filings, cash flows, governance details, and independent corroboration.

## Product Framework
We evaluate every product decision through four lenses:
1. **Truthfulness** – Primary filings (10-K, 10-Q, DEF 14A, 8-K) and auditable citations outrank commentary. Automated cross-checks prevent hallucinations.
2. **Alignment** – Scorecards quantify dilution, governance alignment, and counterparty risk to expose conflicts between insiders and public shareholders.
3. **Momentum** – Continuous monitoring, Monte Carlo adoption forecasts, and alerting keep coverage fresh and reduce stale research.
4. **Coaching** – Every output explains *why* a flag matters so students learn professional skepticism and improve pitches over time.

## Audience & Outcomes
PitchGuard serves three primary audiences:
- **Ole Miss Finance Club members** gain faster diligence cycles, cleaner decks, and interview-ready insights.
- **Faculty advisors & mentors** receive standardized rubrics and audit trails that accelerate feedback and ensure academic integrity.
- **Partner funds & employers** access a pipeline of analysts trained to spot governance and financial landmines before they become portfolio losses.

### Tangible Benefits
- **Heroic win for members**: Because they run PitchGuard, Ole Miss analysts become the "Guardian Closers" who rescue investment theses from hidden risks and deliver decks that win rooms.
- **Time saved**: Automated sourcing, extraction, and scoring shrink a 6-hour diligence loop into ~90 minutes.
- **Money earned**: Better pitches and red-flag awareness boost internship and competition win rates, creating downstream compensation upside.
- **Confidence & trust**: Psychology-backed messaging ("see what insiders hope you ignore") reframes caution as empowerment, motivating consistent use.

## Hero Narrative Playbook
PitchGuard always leads with the member’s victory. Every touchpoint should remind users that *they* are the heroes keeping capital safe:

1. **Promise** – "Run PitchGuard and become the Guardian Closer who signs off on only truth-backed pitches."
2. **Proof** – Surface before/after stories where members spotted dilution traps or governance landmines within minutes.
3. **Path** – In-app copy should call out the next heroic move ("Ship this report to your investment committee and own the diligence win").
4. **Payoff** – Highlight how the saved hours and cleaner hits list translate to more podium finishes, internships, and time to pursue what they love.

Use this framing in onboarding, dashboards, and outbound decks so the user always feels like the protagonist.

## Psychology & Messaging Principles
1. **Empowerment framing** – "You can out-analyze Wall Street by auditing the fine print."
2. **Loss aversion** – Highlight avoided disasters (dilution, governance coups) to reinforce vigilance.
3. **Competence signaling** – Badges and score improvements show mastery, appealing to competitive club culture.
4. **Social proof** – Share anonymized success stories and usage stats from peers to normalize diligence-first workflows.

## Voice & Copy Standards
- **Apple power words first** – Lead with crisp adjectives like *Effortless*, *Instant*, *Brilliant*, and *Confident* to create a premium, optimistic tone.
- **Simple sentences** – Keep guidance to one or two short sentences per surface so any student can succeed without prior training.
- **Hero-centric framing** – Every headline should explain how the user helps their client win; the product is the spotlight, not the star.
- **Actionable next step** – Close each section with a direct verb ("Launch PitchGuard", "Drop this into your deck") so momentum never stalls.

## Monte Carlo Usage Simulation (1-Year Horizon)
The simulation in [`analysis/pitchguard_usage_simulation.py`](../analysis/pitchguard_usage_simulation.py) models 10,000 scenarios of annual usage, combining weekly growth, retention, premium conversion, and time savings. Results:

- **Total analyses completed**: mean 20,628 (p10 14,222, p90 27,756)
- **Hours saved**: mean 37,130 (p10 25,600, p90 49,961)
- **Annual recurring revenue**: mean $1,403 (p10 $933, p90 $1,937)
- **Average premium users**: mean 2.4 (p10 1.6, p90 3.3)
- **Internship offer uplift**: mean +2.6 students (p10 +2.1, p90 +3.2)
- **Daily active user peak**: mean 65.3 (p10 62.4, p90 68.7)

> These figures come from running the script with default assumptions. Update `SimulationConfig` to reflect new pricing, conversion, or growth data as you gather telemetry.

## Recommended Roadmap Adjustments (Executed)
1. **Premium enablement package** – Prioritize onboarding flows that convert ~5–8 power users into paid research pods. (Planned for Q2.)
2. **Case study hub** – Launch success stories in-app to strengthen social proof and reinforce the empowerment narrative. (Design brief scheduled.)
3. **Industry bundle API request** – Integrate Google News MCP server for sector alerts. Requires API key provisioning to capture ex-filing events. (Request opened.)
4. **Time-to-value tracker** – Instrument analysis start → insight delivery latency for ongoing Monte Carlo calibration. (Analytics spec drafted.)

## Additional API Needs
To support the roadmap above we will onboard:
- **Perplexity Search API** – now the primary research engine. Requires `PERPLEXITY_API_KEY` and optional `PERPLEXITY_SEARCH_URL` overrides.
- **OpenAI API (Agents workflow)** – powers the marketing-ready summaries returned alongside Perplexity citations.
- **Google News MCP Server** – surfaces breaking headlines linked to coverage tickers.
- **Slack Webhook API** – sends real-time diligence completion alerts to club channels, increasing perceived responsiveness.

Document any future integrations in `docs/update-log.md` to preserve institutional memory.
