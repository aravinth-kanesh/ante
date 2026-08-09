from app.services.dedupe import deduped, deduped_by


def test_deduped_collapses_reworded_repeats():
    items = [
        "Use the STAR method (Situation, Task, Action, Result) to structure answers with concrete detail.",
        "Use the STAR structure (Situation, Task, Action, Result) to give concrete detail.",
        "Prepare a sixty second introduction covering your background and motivation.",
    ]
    out = deduped(items, threshold=0.5)
    assert len(out) == 2  # the two STAR bullets are one point said twice
    assert out[0].startswith("Use the STAR")
    assert any("introduction" in o for o in out)


def test_deduped_keeps_genuinely_distinct_points():
    items = ["Give a concrete example from a project.", "Speak a little more slowly.", "Research the company's products."]
    assert deduped(items) == items


def test_deduped_drops_blanks():
    assert deduped(["  ", "Real advice here.", ""]) == ["Real advice here."]


def test_deduped_by_objects_uses_the_key():
    class Item:
        def __init__(self, action: str):
            self.action = action

    items = [
        Item("Practise the STAR structure for behavioural questions."),
        Item("Practise using the STAR structure on behavioural questions."),
        Item("Read about the company's engineering culture."),
    ]
    out = deduped_by(items, key=lambda i: i.action, threshold=0.5)
    assert [i.action for i in out] == [items[0].action, items[2].action]
