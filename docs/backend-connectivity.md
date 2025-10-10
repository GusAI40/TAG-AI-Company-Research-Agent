# Backend Connectivity Reference

PitchGuard no longer depends on the legacy Fly.io FastAPI deployment or the LangGraph pipeline. All research runs through the Vercel serverless function at `/api/research/perplexity`, which orchestrates Perplexity Search and the OpenAI-based agent workflow.

## Current architecture

1. **Frontend** – The React UI posts research requests directly to `/api/research/perplexity`.
2. **Perplexity Search** – The serverless function calls the new `/search` endpoint to collect fresh citations.
3. **LangChain orchestrator** – A lightweight LangChain-style pipeline (`lib/research-orchestrator.ts`) sequences validation, Perplexity calls, and agent prompts so every request follows the same audited path.
4. **Agent workflow** – Responses are summarised with the in-repo agent framework (`agents/pitchguard-workflow.ts`), producing ReAct reasoning traces and structured company profiles.
5. **Response** – The API returns the Perplexity synthesis, structured citations, and the agent marketing profile.

No WebSocket or Fly.io coordination is required—the only runtime dependencies are valid `PERPLEXITY_API_KEY` and `OPENAI_API_KEY` environment variables.

## Troubleshooting steps

When the UI reports "Authentication failed" or similar errors:

1. **Verify environment variables**
   - `PERPLEXITY_API_KEY` – must be set for `/api/research/perplexity`.
   - `OPENAI_API_KEY` – required for the agent workflow.
   - `OPENAI_PROJECT_ID` – mandatory whenever the key starts with `sk-proj-`. Copy the identifier directly from the OpenAI dashboard (it must look like `proj_...`). Add `OPENAI_ORG_ID` if your organisation requires it.
2. **Test the Vercel function**
   ```bash
   curl -X POST https://<deployment-domain>/api/research/perplexity \
     -H 'Content-Type: application/json' \
     -d '{"company":"Example Corp","topic":"marketing"}'
   ```
   A healthy deployment responds with HTTP 200 and a JSON payload containing `perplexity` and `agent` fields.
3. **Check rate limits** – Perplexity and OpenAI both enforce per-minute quotas. HTTP 429 responses indicate throttling.
4. **Review logs** – Use `vercel logs` to inspect serverless output if requests fail silently.

## Migration notes

- Previous DNS issues with `tag-ai-company-research-agent.fly.dev` are obsolete; the hostname is no longer used anywhere in the stack.
- WebSocket code remains in the Python backend for archival purposes but is not invoked by the production UI.
- Any future integrations should target the serverless function or add new routes under `api/` rather than reviving the Fly.io deployment.

This document is tracked in `docs/update-log.md` so future contributors understand that Perplexity-only routing is the canonical path.
