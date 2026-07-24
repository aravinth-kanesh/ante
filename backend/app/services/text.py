import re


def strip_markdown(text: str) -> str:
    """Clean model output so it renders as plain, human-looking text.

    Removes heading hashes, bold/italic asterisks and inline code ticks, normalises
    bullet markers to a plain dash, and replaces the typographic characters that
    read as machine-generated (em/en dashes and the ellipsis) with plain ones. Used
    for all user-facing model output (interview questions, feedback, research).
    """
    text = re.sub(r"^\s*[*+-]\s+", "- ", text, flags=re.MULTILINE)  # normalise bullets
    text = re.sub(r"\*+", "", text)  # bold/italic asterisks
    text = re.sub(r"`+", "", text)  # inline code ticks
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
    text = re.sub(r"\s*[—–]\s*", " - ", text)  # em/en dash -> spaced hyphen
    text = text.replace("…", "...")  # ellipsis
    return text.strip()
