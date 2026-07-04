from functools import lru_cache

from openai import OpenAI

from app.config import settings

# The KCL endpoint is OpenAI-compatible, so the openai client works as-is.


@lru_cache
def _client() -> OpenAI:
    return OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)


def chat(messages: list[dict]) -> str:
    completion = _client().chat.completions.create(
        model=settings.llm_model,
        messages=messages,
    )
    return completion.choices[0].message.content or ""
