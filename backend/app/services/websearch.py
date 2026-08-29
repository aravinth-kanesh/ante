"""Optional web search to ground company research in real results.

Uses DuckDuckGo (no API key). It is off by default and fails open: any error, or a
missing dependency, returns no snippets so research simply proceeds LLM-only. Only the
search terms (the company name and role) leave the server, never the user's CV.
"""

import logging

from app.config import settings

logger = logging.getLogger(__name__)


def search_results(query: str, max_results: int | None = None) -> list[dict]:
    """Structured web results (title, url, body) for a query, or [] when off/unavailable."""
    if not settings.web_search_enabled or not query.strip():
        return []
    limit = max_results or settings.web_search_max_results
    try:
        from ddgs import DDGS  # imported lazily so the dependency is only needed when on

        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=limit) or []
    except Exception:
        logger.warning("web search failed; continuing without grounding", exc_info=True)
        return []

    out: list[dict] = []
    for result in results:
        out.append(
            {
                "title": (result.get("title") or "").strip(),
                "url": (result.get("href") or "").strip(),
                "body": (result.get("body") or "").strip(),
            }
        )
    return out[:limit]


def search(query: str, max_results: int | None = None) -> list[str]:
    """Short web snippets for a query, or [] when search is off or unavailable."""
    snippets: list[str] = []
    for result in search_results(query, max_results):
        title, body = result["title"], result["body"]
        if body:
            snippets.append(f"{title}: {body}" if title else body)
    return snippets
