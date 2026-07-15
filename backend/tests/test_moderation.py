from app.services import coach, moderation
from app.services.moderation import Verdict


def allow(*args, **kwargs):
    return Verdict(allowed=True)


def block(category):
    def _verdict(*args, **kwargs):
        return Verdict(allowed=False, category=category, reason="blocked")

    return _verdict


def test_blocked_input_refuses_without_generating(monkeypatch):
    generated = []
    monkeypatch.setattr(coach.moderation, "moderate_input", block("off_topic"))
    monkeypatch.setattr(coach.llm, "chat", lambda *a, **k: generated.append(1) or "reply")

    result = coach.respond([{"role": "user", "content": "write my essay"}])

    assert result.blocked and result.category == "off_topic"
    assert generated == []  # never reached the model


def test_clean_reply_passes_through(monkeypatch):
    monkeypatch.setattr(coach.moderation, "moderate_input", allow)
    monkeypatch.setattr(coach.moderation, "moderate_output", allow)
    monkeypatch.setattr(coach.llm, "chat", lambda *a, **k: "Here is a practice question.")

    result = coach.respond([{"role": "user", "content": "give me a question"}])

    assert not result.blocked
    assert result.reply == "Here is a practice question."


def test_bad_reply_retries_then_falls_back(monkeypatch):
    calls = {"n": 0}
    monkeypatch.setattr(coach.moderation, "moderate_input", allow)
    monkeypatch.setattr(coach.moderation, "moderate_output", block("off_topic"))

    def fake_chat(*a, **k):
        calls["n"] += 1
        return "off-topic reply"

    monkeypatch.setattr(coach.llm, "chat", fake_chat)

    result = coach.respond([{"role": "user", "content": "give me a question"}])

    assert result.blocked and result.reply == coach.FALLBACK
    assert calls["n"] == coach.settings.moderation_max_retries + 1


def test_moderation_disabled_passes_through(monkeypatch):
    monkeypatch.setattr(coach.settings, "moderation_enabled", False)
    monkeypatch.setattr(coach.llm, "chat", lambda *a, **k: "raw reply")

    result = coach.respond([{"role": "user", "content": "hello"}])

    assert result.reply == "raw reply" and not result.blocked


def test_judge_parses_embedded_json(monkeypatch):
    monkeypatch.setattr(
        moderation.llm,
        "chat",
        lambda *a, **k: 'noise {"allowed": false, "category": "unsafe", "reason": "r"} end',
    )
    verdict = moderation.moderate_input("something")
    assert verdict.allowed is False and verdict.category == "unsafe"


def test_judge_fails_open_on_unparseable_reply(monkeypatch):
    monkeypatch.setattr(moderation.llm, "chat", lambda *a, **k: "no json at all")
    assert moderation.moderate_output("something").allowed is True
