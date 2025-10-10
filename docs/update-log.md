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
