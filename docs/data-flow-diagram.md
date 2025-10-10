# PitchGuard Data Flow Diagram

This diagram captures the current Perplexity-first architecture that powers PitchGuard after retiring the legacy Fly.io workflow. Every inbound request follows the same path so the team can audit responses, attach new tools, or troubleshoot failures quickly.

```mermaid
graph TD
    A[Client Browser<br/>PitchGuard UI] -->|POST JSON payload<br/>company, topic, focus| B[Vercel Function<br/>/api/research/perplexity]
    B -->|Normalise body & validate secrets| C[LangChain-style Runnable Sequence]
    C -->|call /search| D[Perplexity API]
    D -->|Answer + citations| C
    C -->|Craft agent prompt| E[OpenAI Agent Workflow<br/>(Runner + Agents)]
    E -->|ReAct trace + structured profile| C
    C -->|Assemble context, traces, citations| B
    B -->|200 JSON response<br/>perplexity + agent payload| A
```

## Flow narrative

1. **Client submission** – The React form sends a POST request with company metadata and optional focus keywords directly to the Vercel route at `/api/research/perplexity`.
2. **Request normalisation** – The handler parses the body, checks for required secrets (`PERPLEXITY_API_KEY`, an available LLM key, and `OPENAI_PROJECT_ID` when required), and forwards the cleaned payload into the orchestrator.
3. **Perplexity search** – The LangChain-style runnable composes the query (or reuses a provided one), clamps the requested result count, and calls Perplexity’s latest `/search` endpoint to obtain a synthesis and citation list.
4. **Agent reasoning** – If an agent provider passes validation (OpenAI with a usable project ID or Gemini), the orchestrator assembles a structured prompt that includes the Perplexity answer and sources, then invokes the in-repo agent workflow to generate marketing-ready company profiles with ReAct traces.
5. **Response assembly** – The runnable sequence packages the Perplexity answer, structured citations, agent traces, and summary profile into a single JSON payload that the Vercel function returns to the browser. The UI renders the summary, citation list, and reasoning trace for the user.

## Operational notes

- **Single ingress point** – All traffic flows through `/api/research/perplexity`; no WebSocket or Fly.io coordination remains in production.
- **Observability** – Failures surface from one of three layers: input validation (400 errors), configuration issues (500), or upstream runtime errors (502 with Perplexity/OpenAI detail previews). Use `vercel logs` to trace real-time failures.
- **Extensibility** – New tools slot into `lib/research-orchestrator.ts` as additional runnable steps. Parallel fetches or retries can be inserted without touching the UI contract.
- **Security** – Keep Perplexity and OpenAI keys in Vercel project secrets. The handler never logs raw keys and only includes summary metadata in responses.
