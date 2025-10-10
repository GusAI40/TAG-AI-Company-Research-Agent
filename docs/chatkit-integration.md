# ChatKit Advanced Integration Guide

PitchGuard now supports the advanced, self-hosted ChatKit deployment model so the Ole Miss Finance Club can run the embeddable
assistant on first-party infrastructure. This document explains how to enable the feature, wire the backend endpoint, and
mount the widget in the React client.

## Overview

The goal of the self-hosted ChatKit flow is to keep the OpenAI-hosted workflow as the reasoning brain while serving the
session orchestration from our FastAPI backend. The flow is:

1. The browser requests a ChatKit client secret from `/chatkit/session`.
2. The backend calls `openai.chatkit.sessions.create` with our workflow ID and returns the client secret.
3. The frontend hands the client secret to the ChatKit web component so it can open the live conversation.

## Backend requirements

* `OPENAI_API_KEY` – already required for the agentic workflow.
* `CHATKIT_WORKFLOW_ID` – the workflow identifier from Agent Builder.
* FastAPI endpoint `/chatkit/session` – implemented in `application.py`.

The endpoint validates configuration, creates the session via the OpenAI Python SDK, and returns `{ "client_secret": "..." }`.
Helpful error messages are emitted when the SDK or environment variables are missing so operators can self-diagnose issues.

## Frontend wiring

1. Load the ChatKit script in `index.html`:

   ```html
   <script
     src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
     async
   ></script>
   ```

2. Create a helper that POSTs to `/api/chatkit/session` (proxied to FastAPI) and returns the client secret.
3. Mount the `<ChatKit>` component from `@openai/chatkit-react` or the vanilla web component and pass the helper via
   `getClientSecret` so sessions refresh automatically.

A sample React hook is shown in the docstring inside `docs/chatkit-integration.md` and mirrors the OpenAI reference
implementation. The widget can be themed to match the equilibrium gradient palette already used across the app.

## Deployment checklist

* Ensure the backend has outbound access to `api.openai.com`.
* Add `CHATKIT_WORKFLOW_ID` to the hosting environment.
* Confirm the frontend domain is allowed in the CORS configuration (already handled by `application.py`).
* Verify the ChatKit embed loads successfully in staging before promoting to production.

## Operational notes

* The endpoint is stateless and safe to expose behind deployment protection. Rotate workflow IDs if compromised.
* Logs include contextual errors when OpenAI responds with a non-2xx status code.
* Upgrade the `openai` Python SDK if a 501 response indicates the installed version predates ChatKit support.

By running ChatKit on our own backend we retain full control over authentication, analytics, and data residency while reusing
the same agentic workflow that powers the Perplexity-only research experience.
