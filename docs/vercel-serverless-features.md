# Vercel Serverless Feature Opportunities

PitchGuard now deploys multiple Vercel Serverless Functions alongside the flagship `/api/research/perplexity` endpoint. This
page captures what is live today and the high-impact ideas we still plan to build as the Ole Miss Finance Club scales its agen
tic tooling.

## Implemented features

### `/api/health`
- **Purpose**: Runs reachability and latency probes against Perplexity, OpenAI, Gemini, and the SEC submissions API.
- **Output**: JSON payload with status, HTTP codes, and diagnostics that feed the Serverless Ops Radar card in the UI.
- **Notes**: Reads existing keys (`PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SEC_USER_AGENT`) when available an
d treats 4xx responses as “reachable” to avoid false alarms.

### `/api/sec/filings`
- **Purpose**: Converts a ticker or CIK into the latest EDGAR filings with direct document links.
- **Usage**: Powers the SEC Filing Fast Pass panel so reviewers can open 10-K/10-Q/8-K documents without leaving PitchGuard.
- **Notes**: Caches the SEC ticker dictionary per serverless instance and honours any custom `SEC_USER_AGENT` header.

### `/api/insights/benchmark`
- **Purpose**: Accepts revenue, EBITDA, net income, cash, debt, dilution, and share-count histories and returns a diligence sc
orecard.
- **Output**: Metric interpretations, risk flags, and analyst notes that drive the Pitch Benchmark Studio interface.
- **Notes**: Requires only JSON input—no external API credentials—and handles partial datasets gracefully.

## High-impact backlog

The following features remain on the roadmap. They assume the Perplexity → Gemini → Agent orchestration already in production
and favour short, auditable HTTP bursts that suit Vercel’s serverless platform.

### 1. Compliance snapshots and attestations
- **What**: `/api/compliance/snapshot` assembles disclosure extracts (10-K risk factors, dilution tables) and returns a signed h
ash.
- **Why**: Creates an audit trail for which facts informed each pitch.
- **How**: Reuse Perplexity retrieval, cache rendered snippets in Vercel KV, and stream progress via SSE.

### 2. Rapid-fire KPI probes
- **What**: `/api/metrics/{ticker}` surfaces liquidity, profitability, and growth metrics for dashboards or Slack alerts.
- **Why**: Gives judges instant fact checks mid-pitch.
- **How**: Pull SEC XBRL facts, normalise in Node, and cache responses for a trading day.

### 3. Alternative data ingestion hooks
- **What**: `/api/webhooks/news` ingests curated RSS, sentiment, or MCP feeds into the research corpus.
- **Why**: Keeps the knowledge base warm between full research runs.
- **How**: Validate payloads with the in-repo Zod clone, deduplicate URLs, and notify analysts via the diagnostics rail.

### 4. Scheduled refresh runs
- **What**: `/api/tasks/daily-refresh` pairs with Vercel Cron Jobs to re-run deep research on watchlist tickers.
- **Why**: Ensures the club sees overnight developments before presentations.
- **How**: Reuse `runResearchPipeline`, persist outputs in Vercel KV/Supabase, and display freshness badges in the UI.

### 5. Secure document upload processing
- **What**: `/api/uploads/analyse` ingests PDF decks or bespoke research artifacts.
- **Why**: Extends PitchGuard beyond public filings.
- **How**: Store uploads in Vercel Blob, run OCR/embedding extraction, and append findings to the agent workflow state.

### 6. Concierge coaching responses
- **What**: `/api/coach/qna` wraps the agent workflow with role-specific prompts (judge, mentor, peer).
- **Why**: Provides instant coaching and pitch tightening feedback.
- **How**: Inject personas into `agents/pitchguard-workflow.ts`, throttle per user, and log exchanges for retros.

### 7. Incident and quota monitors
- **What**: `/api/ops/health` checks API quotas and rate limits across Perplexity, Gemini, and OpenAI.
- **Why**: Prevents surprises during live competitions.
- **How**: Hit provider status endpoints, inspect environment settings, and surface warnings in the diagnostics panel.

## Implementation checklist

1. Define Zod schemas in `lib/zod.ts` for each new endpoint’s request/response payload.
2. Register handlers under `api/` with explicit runtime and error handling.
3. Update `docs/environment-config.md` when new secrets or webhooks are required.
4. Extend the UI diagnostics rail when background jobs or caches surface new signals.
5. Log every serverless rollout in `docs/update-log.md` to preserve operational history.
