# Environment Configuration Guide

This guide explains which environment variables PitchGuard currently consumes, which legacy variables can be removed, and how a
 request flows through the code when it calls the configured language-model provider.

## Required variables

Set these secrets in every deployment (local development, Vercel, or elsewhere):

| Variable | Purpose |
| --- | --- |
| `PERPLEXITY_API_KEY` | Authorises calls to the Perplexity `/search` endpoint that powers document retrieval. |
| `OPENAI_API_KEY` **or** `GEMINI_API_KEY` | At least one LLM provider must be configured. Supply the OpenAI key for Chat Completions, or use a Google AI Studio key to route requests through Gemini. |
| `OPENAI_PROJECT_ID` | Required **only** when the OpenAI key begins with `sk-proj-`. PitchGuard attempts to auto-discover the matching `proj_…` identifier via `GET /v1/projects`; if the lookup fails, the agent tier is disabled and the UI surfaces a helpful message until the value is provided. |

Optional variables:

| Variable | When to use |
| --- | --- |
| `PITCHGUARD_AGENT_PROVIDER` | Force a provider (`openai` or `gemini`) when both API keys are present. Defaults to OpenAI if its key exists, otherwise Gemini. |
| `GEMINI_AGENT_MODEL` | Override the Gemini model name (defaults to `gemini-2.5-flash` for “mini” agents and `gemini-2.5-pro` otherwise). |
| `GEMINI_DEEP_RESEARCH_MODEL` | Change the Gemini Deep Research model (defaults to `gemini-2.0-flash`; PitchGuard automatically queries `ListModels` and retries `gemini-2.0-pro`, `gemini-2.5-flash`, and `gemini-2.5-pro` if a model returns 404/400). |
| `GEMINI_DEEP_RESEARCH_URL` | Override the Google Generative Language API base (defaults to `https://generativelanguage.googleapis.com/v1beta`). |
| `OPENAI_ORG_ID` | Include only if your organisation enforces org scoping on API requests. |
| `PERPLEXITY_SEARCH_URL` | Override when pointing at a mock Perplexity server; otherwise the default `https://api.perplexity.ai/search` is used. |
| `AI_GATEWAY_URL` | Point the streaming chat endpoint at the Vercel AI Gateway (or another OpenAI-compatible proxy) when you want provider swaps, caching, or audit controls. |
| `AI_CHAT_MODEL` | Defaults to `gpt-4o-mini`. Set this to change the primary streaming chat model without touching code. |
| `AI_CHAT_FALLBACK_MODELS` | Comma-separated fallback list (for example: `gpt-4o,gpt-4o-mini`). The `/api/chat` handler will attempt each option in order until one succeeds. |

> **Note**: The new serverless utilities (`/api/health`, `/api/sec/filings`, `/api/insights/benchmark`, `/api/insights/anomaly`, `/api/automation/playbook`, and `/api/chat`) do not introduce additional secrets. They reuse the keys above and gracefully handle scenarios where a provider-specific key is missing by reporting a degraded status or, in the case of `/api/chat`, returning a descriptive 500-level error. The chat endpoint now honours `AI_GATEWAY_URL`, `AI_CHAT_MODEL`, and `AI_CHAT_FALLBACK_MODELS` to unlock the Vercel AI SDK v5 gateway and quick model swaps without redeploying.

> **npm installs**: The repository now ships with a root `.npmrc` (and a mirrored copy in `ui/`) that sets `production=false`. This guarantees build-time tools such as `tsc` and `vite` install even when the host environment defaults to production installs (for example, when running `npm run build --prefix ui` in CI). Keep the file in place so dev dependencies remain available during builds.

## Legacy variables to delete

The frontend no longer calls the Fly.io backend, so the following environment variables are safe to remove from Vercel, `.env`, an
d other deployment surfaces:

- `VITE_API_URL`
- `VITE_WS_URL`
- Any other `VITE_*` variables tied to the retired LangGraph + WebSocket flow.

Removing them avoids confusion when debugging networking issues.

## How model calls are made

1. The React client posts to `/api/research/perplexity` (see `api/research/perplexity.ts`).
2. That handler normalises the payload and invokes `runResearchPipeline` from `lib/research-orchestrator.ts`.
3. The orchestrator calls Gemini Deep Research (when `GEMINI_API_KEY` is present) via `lib/research-orchestrator.ts`, normalising the JSON summary and citations before handing the result to downstream agents.
4. The orchestrator then calls the in-repo agent workflow defined in `agents/pitchguard-workflow.ts`.
5. The workflow relies on the `Runner` from `lib/openai-agents.ts`, which now supports both OpenAI and Gemini.
6. `Runner` asks `resolveAgentProvider` to decide which provider is usable. The resolver respects `PITCHGUARD_AGENT_PROVIDER`, verifies project-scoped OpenAI keys have a usable `OPENAI_PROJECT_ID`, and falls back to Gemini when available.
7. For OpenAI, `buildOpenAIHeaders` constructs the headers and attaches the project identifier discovered earlier (or supplied in `OPENAI_PROJECT_ID`) while forwarding `OPENAI_ORG_ID` when present.
8. For Gemini, `Runner` maps the configured model name to a Gemini 2.5 variant and issues a `generateContent` call via the Google Generative Language API (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`).

Follow this path when debugging: start at the serverless handler, confirm the orchestrator receives the keys, and make sure the selected provider sees the expected environment state.

## Quick verification script

Use this snippet to list project IDs tied to your key:

```bash
curl -s https://api.openai.com/v1/projects \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq -r '.data[].id'
```

Use the matching `proj_…` value for `OPENAI_PROJECT_ID` when working with project-scoped keys. If your key does **not** start with
`sk-proj-`, leave `OPENAI_PROJECT_ID` unset.
