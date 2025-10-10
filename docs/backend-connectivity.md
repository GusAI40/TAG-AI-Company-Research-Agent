# Backend Connectivity Diagnosis

This note summarizes the investigation into the research backend / LangGraph pipeline not being reachable from the deployed UI.

## Observed behaviour

- Browser console shows repeated failures when posting to `https://tag-ai-company-research-agent.fly.dev/research`, ending with `net::ERR_NAME_NOT_RESOLVED`.
- After the automatic fallback to the Vercel preview deployment, every request is rejected with HTTP 401 due to deployment protection.
- The UI therefore triggers the Perplexity fallback and surfaces "Authentication failed" guidance in the connection diagnostics panel.

## Direct network checks

From the project workspace we ran a DNS lookup and an HTTPS probe:

```bash
nslookup tag-ai-company-research-agent.fly.dev
curl -I https://tag-ai-company-research-agent.fly.dev
```

- `nslookup` returns `NXDOMAIN`, which means there is currently no DNS record for that Fly.io app name.
- `curl` fails to establish a tunnel because the hostname cannot be resolved to an active Fly machine from this environment.

The combination confirms the Fly app referenced by `VITE_API_URL` / `VITE_WS_URL` is **not deployed or not named correctly**, so the UI has no reachable primary backend.

## Why LangGraph appears "unreachable"

The LangGraph workflow is executed inside the FastAPI backend (`application.py`). Because the frontend never reaches the backend, the workflow never starts. The issue is therefore infrastructural (missing Fly deployment), not an error inside the LangGraph nodes.

## Required actions

1. Deploy (or redeploy) the backend to Fly with the expected app name, or update the environment variables to point at an existing deployment.
   - `fly launch --copy-config --name tag-ai-company-research-agent`
   - `fly deploy`
2. If you prefer Vercel for the backend, expose an unprotected endpoint (remove Preview Protection or supply a bypass token) and update `VITE_API_URL` / `VITE_WS_URL`.
3. After the backend is reachable, verify by calling the health endpoint:

```bash
curl https://<your-backend-domain>/health
```

Once the HTTP request succeeds, the LangGraph workflow will run as designed.

## Logging

The investigation steps above have been logged in `docs/update-log.md` for future reference.
