# Vercel Serverless Feature Opportunities

PitchGuard already leans on the `/api/research/perplexity` function for retrieval, but Vercel’s serverless platform leaves room for additional capabilities that enhance investor briefings, guardrails, and operational tooling. The ideas below assume the existing Perplexity → Gemini → Agent pipeline and highlight features that play to Vercel’s strengths: low-latency HTTP triggers, background jobs, and edge-ready data processing.

## 1. Compliance snapshots and attestations
- **What**: Expose `/api/compliance/snapshot` to assemble a time-stamped package of disclosures (latest 10-K sections, risk-factor excerpts, dilution tables) and return a signed hash for club records.
- **Why**: Finance teams can prove what information informed a pitch without storing large filings in the browser.
- **How**: Reuse the orchestrator’s Perplexity fetch, cache rendered snippets in Vercel KV or Upstash, and stream the report via Server-Sent Events for transparency.

## 2. Rapid-fire KPI probes
- **What**: Add `/api/metrics/{ticker}` that returns pre-computed liquidity, profitability, and growth metrics for dashboards or Slack alerts.
- **Why**: Judges and mentors get instant fact checks during a pitch.
- **How**: Call the SEC facts endpoint, normalise figures with the existing `backend/services/perplexity_service.py` helpers, and cache responses for a trading day.

## 3. Alternative data ingestion hooks
- **What**: Implement webhooks (e.g., `/api/webhooks/news`) to accept curated RSS, sentiment, or MCP search feeds and push them into the document pool.
- **Why**: Keeps the knowledge base warm without running a full job from the UI.
- **How**: Validate payloads with the in-repo Zod clone, deduplicate against stored URLs, and notify analysts through the status panel.

## 4. Scheduled refresh runs
- **What**: Pair Vercel Cron Jobs with `/api/tasks/daily-refresh` to re-run deep research on active watchlist tickers every morning.
- **Why**: Ensures the club reviews overnight changes before presentations.
- **How**: Reuse `runResearchPipeline`, persist summaries in Vercel KV/Supabase, and surface “freshness” badges in the results panel.

## 5. Secure document upload processing
- **What**: Provide `/api/uploads/analyse` for members to drop PDF decks or custom research.
- **Why**: Extends the grader beyond public filings.
- **How**: Store uploads in Vercel Blob, run lightweight OCR or embedding extraction, and append references to the agent workflow state.

## 6. Concierge coaching responses
- **What**: Add `/api/coach/qna` that wraps the existing agent workflow with role-specific instructions (judge, mentor, peer review).
- **Why**: Gives immediate feedback on how to tighten an argument before pitch day.
- **How**: Inject personas into `agents/pitchguard-workflow.ts`, throttle usage per user, and log exchanges for coaching retrospectives.

## 7. Incident and quota monitors
- **What**: Create `/api/ops/health` to check Perplexity, Gemini, and OpenAI quota status, returning actionable guidance.
- **Why**: Prevents surprise outages during live competitions.
- **How**: Hit provider status endpoints, inspect environment variables (`docs/environment-config.md`), and expose the result in the diagnostics panel.

## Implementation checklist
1. Define Zod schemas in `lib/zod.ts` for each new endpoint’s request/response payload.
2. Register matching handlers under `api/` with clear runtime (Edge vs Node) requirements.
3. Update `docs/environment-config.md` when new secrets or webhooks are added.
4. Extend the UI diagnostics rail so members can observe background tasks and cache freshness.
5. Log each rollout in `docs/update-log.md` to preserve operational history.

These additions keep Vercel serverless functions focused on short, auditable bursts of work—perfect for augmenting the research workflow without reintroducing long-running infrastructure.
