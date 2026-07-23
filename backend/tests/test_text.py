from app.services.text import strip_markdown


def test_strip_markdown_removes_headings_bold_and_ticks():
    out = strip_markdown("### **Feedback**\n**Strong** answer using `git`.")
    assert "*" not in out and "#" not in out and "`" not in out
    assert out.startswith("Feedback")
    assert "Strong answer using git." in out


def test_strip_markdown_normalises_bullets():
    out = strip_markdown("* first\n- second\n  * indented")
    assert "*" not in out
    for line in out.splitlines():
        assert line.strip().startswith("- ")


def test_strip_markdown_leaves_plain_text_untouched():
    plain = "The candidate gave a clear, specific example and structured it well."
    assert strip_markdown(plain) == plain
