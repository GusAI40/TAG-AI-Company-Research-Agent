# Environment Configuration Guide

This guide explains which environment variables PitchGuard currently consumes, which legacy variables can be removed, and how a
 request flows through the code when it calls the configured language-model provider.

## Required variables

Set these secrets in every deployment (local development, Vercel, or elsewhere):

| Variable | Purpose |
| --- | --- |
| `PERPLEXITY_API_KEY` | Authorises calls to the Perplexity `/search` endpoint that powers document retrieval. |
| `OPENAI_API_KEY` **or** `GEMINI_API_KEY` | At least one LLM provider must be configured. Supply the OpenAI key for Chat Completions, or use a Google AI Studio key to route requests through Gemini. |
| `OPENAI_PROJECT_ID` | Required **only** when the OpenAI key begins with `sk-proj-`. If omitted, PitchGuard now auto-discovers the matching `proj_…` identifier via `GET /v1/projects`, but supplying it explicitly avoids an extra network round trip. |

Optional variables:

| Variable | When to use |
| --- | --- |
| `PITCHGUARD_AGENT_PROVIDER` | Force a provider (`openai` or `gemini`) when both API keys are present. Defaults to OpenAI if its key exists, otherwise Gemini. |
| `GEMINI_AGENT_MODEL` | Override the Gemini model name (defaults to `gemini-1.5-flash` for “mini” agents and `gemini-1.5-pro` otherwise). |
| `OPENAI_ORG_ID` | Include only if your organisation enforces org scoping on API requests. |
| `PERPLEXITY_SEARCH_URL` | Override when pointing at a mock Perplexity server; otherwise the default `https://api.perplexity.ai/search` is used. |

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
3. The orchestrator calls the in-repo agent workflow defined in `agents/pitchguard-workflow.ts`.
4. The workflow relies on the `Runner` from `lib/openai-agents.ts`, which now supports both OpenAI and Gemini.
5. `Runner` determines the provider in this order:
   - Respect `PITCHGUARD_AGENT_PROVIDER` when set.
   - Otherwise pick OpenAI if `OPENAI_API_KEY` exists, or Gemini if only `GEMINI_API_KEY` is present.
6. For OpenAI, `buildOpenAIHeaders` constructs the headers, handles `OPENAI_PROJECT_ID` (with auto-discovery for `sk-proj-` keys), and forwards `OPENAI_ORG_ID` when supplied.
7. For Gemini, `Runner` maps the configured model name to a Gemini variant and issues a `generateContent` call via the Google Generative Language API.

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
