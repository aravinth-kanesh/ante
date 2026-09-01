from app.services import moderation


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


def test_moderation_respects_the_enabled_flags(monkeypatch):
    # When a check is disabled it allows without calling the judge at all.
    called = []
    monkeypatch.setattr(moderation.llm, "chat", lambda *a, **k: called.append(1) or "{}")
    monkeypatch.setattr(moderation.settings, "moderate_input_enabled", False)
    monkeypatch.setattr(moderation.settings, "moderate_output_enabled", False)

    assert moderation.moderate_input("anything").allowed is True
    assert moderation.moderate_output("anything").allowed is True
    assert called == []  # the judge was never invoked
