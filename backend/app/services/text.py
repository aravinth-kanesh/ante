import re


def strip_markdown(text: str) -> str:
    """Strip common Markdown so model output renders cleanly as plain text.

    Removes heading hashes, bold/italic asterisks and inline code ticks, and
    normalises bullet markers to a plain dash. Used for user-facing model output
    (company research, interview feedback) that is displayed as plain text.
    """
    text = re.sub(r"^\s*[*+-]\s+", "- ", text, flags=re.MULTILINE)  # normalise bullets
    text = re.sub(r"\*+", "", text)  # bold/italic asterisks
    text = re.sub(r"`+", "", text)  # inline code ticks
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
    return text.strip()
