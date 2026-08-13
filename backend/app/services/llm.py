from functools import lru_cache

from openai import OpenAI

from app.config import settings

# The endpoint is OpenAI-compatible, so the openai client works as-is.


@lru_cache
def _client() -> OpenAI:
    return OpenAI(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        timeout=settings.llm_timeout_seconds,
        max_retries=settings.llm_max_retries,
    )


def chat(
    messages: list[dict],
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    if settings.llm_fake:
        from app.services import fake_llm

        return fake_llm.reply(messages)

    kwargs: dict = {}
    if temperature is not None:
        kwargs["temperature"] = temperature
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    completion = _client().chat.completions.create(
        model=model or settings.llm_model,
        messages=messages,
        **kwargs,
    )
    return completion.choices[0].message.content or ""
