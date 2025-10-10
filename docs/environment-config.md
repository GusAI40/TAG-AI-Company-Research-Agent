# Environment Configuration Guide

This guide explains which environment variables PitchGuard currently consumes, which legacy variables can be removed, and how a
 request flows through the code when it calls the OpenAI API.

## Required variables

Set these secrets in every deployment (local development, Vercel, or elsewhere):

| Variable | Purpose |
| --- | --- |
| `PERPLEXITY_API_KEY` | Authorises calls to the Perplexity `/search` endpoint that powers document retrieval. |
| `OPENAI_API_KEY` | Lets the in-repo agent framework send prompts to OpenAI's Chat Completions API. |
| `OPENAI_PROJECT_ID` | Required **only** when the API key begins with `sk-proj-`. If omitted, PitchGuard attempts to auto-discover the matching `proj_…` identifier via `GET /v1/projects`, but supplying it explicitly avoids an extra network round trip. |

Optional variables:

| Variable | When to use |
| --- | --- |
| `OPENAI_ORG_ID` | Include only if your organisation enforces org scoping on API requests. |
| `PERPLEXITY_SEARCH_URL` | Override when pointing at a mock Perplexity server; otherwise the default `https://api.perplexity.ai/search` is used. |

## Legacy variables to delete

The frontend no longer calls the Fly.io backend, so the following environment variables are safe to remove from Vercel, `.env`, an
d other deployment surfaces:

- `VITE_API_URL`
- `VITE_WS_URL`
- Any other `VITE_*` variables tied to the retired LangGraph + WebSocket flow.

Removing them avoids confusion when debugging networking issues.

## How OpenAI calls are made

1. The React client posts to `/api/research/perplexity` (see `api/research/perplexity.ts`).
2. That handler normalises the payload and invokes `runResearchPipeline` from `lib/research-orchestrator.ts`.
3. The orchestrator calls the in-repo agent workflow defined in `agents/pitchguard-workflow.ts`.
4. The workflow relies on `Runner` from `lib/openai-agents.ts`, which builds the HTTP request to `https://api.openai.com/v1/chat/completions` with the headers constructed by `buildOpenAIHeaders`.
5. `buildOpenAIHeaders` checks the environment:
   - It always reads `OPENAI_API_KEY`.
   - When the key starts with `sk-proj-`, it first looks for `OPENAI_PROJECT_ID` shaped like `proj_…`; if absent, it issues a one-off `GET /v1/projects` call and caches the discovered ID.
   - If `OPENAI_ORG_ID` is provided, it forwards the organisation header as well.
6. If discovery fails (for example, the token cannot list projects), `Runner` throws a descriptive error so deployments fail fast with a clear message.

Follow this path when debugging: start at the serverless handler, confirm the orchestrator receives the keys, and make sure `buildO
penAIHeaders` sees the expected environment state.

## Quick verification script

Use this snippet to list project IDs tied to your key:

```bash
curl -s https://api.openai.com/v1/projects \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq -r '.data[].id'
```

Use the matching `proj_…` value for `OPENAI_PROJECT_ID` when working with project-scoped keys. If your key does **not** start with
`sk-proj-`, leave `OPENAI_PROJECT_ID` unset.
