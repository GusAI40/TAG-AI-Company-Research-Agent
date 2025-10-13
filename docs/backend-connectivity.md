# Backend Connectivity Reference

PitchGuard no longer depends on the legacy Fly.io FastAPI deployment or the LangGraph pipeline. All research runs through the Vercel serverless function at `/api/research/perplexity`, which orchestrates Perplexity Search and the agent workflow (OpenAI or Gemini).

## Current architecture

1. **Frontend** – The React UI posts research requests directly to `/api/research/perplexity`.
2. **Perplexity Search** – The serverless function calls the new `/search` endpoint to collect fresh citations.
3. **LangChain orchestrator** – A lightweight LangChain-style pipeline (`lib/research-orchestrator.ts`) sequences validation, Perplexity calls, and agent prompts so every request follows the same audited path.
4. **Agent workflow** – Responses are summarised with the in-repo agent framework (`agents/pitchguard-workflow.ts`), producing ReAct reasoning traces and structured company profiles using the configured provider (OpenAI by default, Gemini when selected).
5. **Response** – The API returns the Perplexity synthesis, structured citations, and the agent marketing profile.

No WebSocket or Fly.io coordination is required—the only runtime dependencies are `PERPLEXITY_API_KEY` plus either `OPENAI_API_KEY` (and `OPENAI_PROJECT_ID` when applicable) or `GEMINI_API_KEY`.

## Troubleshooting steps

When the UI reports "Authentication failed" or similar errors:

1. **Verify environment variables**
   - `PERPLEXITY_API_KEY` – must be set for `/api/research/perplexity`.
   - `OPENAI_API_KEY` **or** `GEMINI_API_KEY` – at least one provider must be configured. When both are present, `PITCHGUARD_AGENT_PROVIDER` can force a specific choice.
   - `OPENAI_PROJECT_ID` – mandatory whenever the OpenAI key starts with `sk-proj-`. Copy the identifier directly from the OpenAI dashboard (Settings → Projects) so it looks like `proj_...`. You can also verify it via the API:
     ```bash
     curl -s https://api.openai.com/v1/projects \
       -H "Authorization: Bearer $OPENAI_API_KEY" \
       | jq -r '.data[].id'
     ```
     Add `OPENAI_ORG_ID` if your organisation requires it. Gemini deployments may also set `GEMINI_AGENT_MODEL` to override the default model. The deep research step defaults to `gemini-2.0-flash` and automatically retries `gemini-2.0-pro`, `gemini-2.5-flash`, then `gemini-2.5-pro` when Google returns 400/404 errors, so override `GEMINI_DEEP_RESEARCH_MODEL` only if you have access to a newer variant.
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

- Previous DNS issues with `tag-ai-company-research-agent.fly.dev` are obsolete; the hostname is no longer used anywhere in the stack and the `VITE_WS_URL`/`VITE_API_URL` environment variables can be removed from Vercel.
- WebSocket code remains in the Python backend for archival purposes but is not invoked by the production UI.
- Any future integrations should target the serverless function or add new routes under `api/` rather than reviving the Fly.io deployment.

This document is tracked in `docs/update-log.md` so future contributors understand that Perplexity-only routing is the canonical path.
