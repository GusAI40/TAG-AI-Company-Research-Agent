# PitchGuard Update Log

## 2025-03-17
- Added Monte Carlo usage simulation script (`analysis/pitchguard_usage_simulation.py`) to forecast annual impact.
- Documented purpose, psychology messaging, and roadmap adjustments in `docs/pitchguard-vision.md`.
- Declared new API dependencies (Google News MCP server, Slack Webhook API) for future integration.
- Calibrated requirements to keep simulation pure-Python for easier execution in restricted environments.

## 2025-03-18
- Wired a Perplexity Search fallback API (`/research/perplexity`) plus an equilibrium-themed UI panel that auto-runs when the primary research service is unreachable.
- Added `httpx` dependency and backend service wrapper for Perplexity responses with normalised citations.
- Refreshed docs to highlight the new Perplexity integration and recorded the change for future audits.

## 2025-03-19
- Investigated backend connectivity and confirmed the configured Fly.io hostname (`tag-ai-company-research-agent.fly.dev`) does not resolve, causing LangGraph jobs never to start.
- Documented the DNS and HTTP probes in `docs/backend-connectivity.md` with required remediation steps for deploying the research service.

## 2025-03-20
- Provisioned an edge function at `/api/research/perplexity` so Vercel deployments can execute Perplexity fallback searches without relying on the unreachable Fly.io backend.
- Updated the UI fallback workflow to leverage the on-origin endpoint, ensuring automatic recovery from DNS failures while retaining detailed connection diagnostics.

## 2025-03-21
- Rewired the stack to remove Fly.io dependencies and route all research through the Vercel `/api/research/perplexity` function.
- Added a lightweight in-repo Agents SDK shim plus Zod-like validation so the workflow can run without pulling private npm packages.
- Simplified the React client to call the new API directly and present Perplexity/agent output in a dedicated results panel.
- Updated backend connectivity docs to reflect the Perplexity-only architecture and documented the required environment variables.
- Swapped the research edge function to Vercel's supported `nodejs` runtime to keep deployments green after removing Fly.io.
- Extended the agent workflow with a ReAct reasoning trace, updated schemas with Zod validation, and surfaced the step-by-step reasoning in the UI for transparency.

## 2025-03-22
- Added a FastAPI endpoint at `/chatkit/session` that brokers ChatKit client secrets using the OpenAI workflow ID and API key.
- Documented the self-hosted ChatKit flow in `docs/chatkit-integration.md`, including environment variables, frontend wiring, and operational guidance.
- Ensured the endpoint emits actionable diagnostics when configuration or SDK support is missing to streamline operator debugging.

## 2025-03-23
- Repointed the agent workflow to the in-repo OpenAI Agents shim and Zod clone so Vercel runtimes no longer require external `@openai/agents` or `zod` packages.
- Removed the temporary tsconfig path aliases to avoid masking missing runtime dependencies in future builds.
- Elevated the hero-focused messaging in the product vision and UI so members lead every narrative win when presenting PitchGuard insights.
- Refined the UI copy with Apple-style power words, simplified launch guidance, and documented the voice rules in `docs/pitchguard-vision.md` to keep the experience effortless for every user.
- Added support for project-scoped OpenAI keys by requiring `OPENAI_PROJECT_ID` and propagating optional organization headers so hosted deployments stop failing with 401 errors.

## 2025-03-24
- Introduced a LangChain-style orchestration pipeline (`lib/research-orchestrator.ts`) to validate inputs, call Perplexity, and trigger the OpenAI agents in a repeatable sequence.
- Added an in-repo runnable implementation (`lib/langchain-lite.ts`) to mirror LangChain's workflow primitives without external installs.
- Updated the backend connectivity guide to highlight the new orchestrator and keep operators aligned on the Perplexity-first architecture.
- Enhanced project-scoped OpenAI key support by auto-inferring the project identifier from `sk-proj-` secrets while still honouring `OPENAI_PROJECT_ID`, reducing 401 failures when the variable is omitted.
