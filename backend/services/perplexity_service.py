"""Utilities for calling the Perplexity Search API as a research fallback."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import httpx


logger = logging.getLogger(__name__)

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_SEARCH_URL = os.getenv(
    "PERPLEXITY_SEARCH_URL", "https://api.perplexity.ai/search"
)


class PerplexityConfigurationError(RuntimeError):
    """Raised when the Perplexity integration is misconfigured."""


class PerplexitySearchError(RuntimeError):
    """Raised when the Perplexity API returns an error response."""


def _build_headers() -> Dict[str, str]:
    if not PERPLEXITY_API_KEY:
        raise PerplexityConfigurationError(
            "PERPLEXITY_API_KEY is not configured. Set it to enable the Perplexity fallback."
        )

    return {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }


def _normalise_results(raw_results: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not raw_results:
        return []

    normalised: List[Dict[str, Any]] = []
    for result in raw_results:
        normalised.append(
            {
                "title": result.get("title") or result.get("name") or "Untitled result",
                "url": result.get("url") or result.get("source"),
                "snippet": result.get("snippet")
                or result.get("text")
                or result.get("description")
                or "",
                "score": result.get("score"),
                "published_at": result.get("published_at"),
            }
        )

    return normalised


async def run_perplexity_search(
    query: str,
    *,
    focus_topics: Optional[List[str]] = None,
    max_results: int = 6,
) -> Dict[str, Any]:
    """Execute a Perplexity Search query and return a simplified payload.

    Parameters
    ----------
    query:
        The natural language query we want the Perplexity Search API to answer.
    focus_topics:
        Optional list of focus topics (Perplexity "focus" parameter) that nudges
        the search engine towards specific domains.
    max_results:
        The number of search results to request.
    """

    payload: Dict[str, Any] = {"query": query, "top_k": max_results}
    if focus_topics:
        payload["focus"] = focus_topics

    headers = _build_headers()

    logger.info("Calling Perplexity search for query: %s", query)

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            PERPLEXITY_SEARCH_URL,
            json=payload,
            headers=headers,
        )

    if response.status_code >= 400:
        preview = response.text[:400]
        logger.error("Perplexity search failed (%s): %s", response.status_code, preview)
        raise PerplexitySearchError(
            f"Perplexity search failed with status {response.status_code}: {preview}"
        )

    data: Dict[str, Any] = response.json()

    return {
        "query": query,
        "answer": data.get("answer") or data.get("summary") or "",
        "results": _normalise_results(data.get("results")),
        "usage": data.get("usage"),
    }

