"""Curate model output so the advice a student sees is diverse and non-repetitive.

The language model sometimes makes the same point several times in different words
(for example telling the candidate to use the STAR structure in three separate
bullets). Prompts ask it not to, but the guarantee lives here: a deterministic pass
that removes near-duplicate items from a list before it reaches the student. Two
items are treated as duplicates when their content words overlap enough (Jaccard
similarity), so reworded repeats are caught, not just exact matches.
"""

import string
from typing import Callable, TypeVar

T = TypeVar("T")

# Common words carry no topic signal, so they are ignored when comparing items.
_STOPWORDS = frozenset(
    {
        "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "your",
        "you", "it", "its", "their", "them", "they", "that", "this", "is", "are", "be",
        "as", "at", "by", "so", "use", "using", "used", "include", "including", "provide",
        "providing", "give", "giving", "when", "which", "into", "from", "more", "some",
        "any", "each", "also", "such", "like", "will", "can", "could", "should", "would",
        "about", "how", "what", "why", "make", "making", "do", "doing", "not", "no", "if",
        "but", "then", "than", "up", "out", "get", "show", "showing", "add", "adding",
        "clear", "specific", "example", "examples", "answer", "answers",
    }
)


def _signature(text: str) -> frozenset[str]:
    tokens = (t.strip(string.punctuation) for t in text.lower().split())
    return frozenset(t for t in tokens if len(t) > 2 and t not in _STOPWORDS)


# Two items also count as duplicates when they share at least this many distinctive
# content words, which catches "same point, different example" (for example three
# pieces of STAR advice) without merging short bullets that only share a word or two.
_MIN_SHARED = 4


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _is_duplicate(sig: frozenset[str], signatures: list[frozenset[str]], threshold: float) -> bool:
    for other in signatures:
        if not sig or not other:
            continue
        shared = len(sig & other)
        if shared >= _MIN_SHARED or shared / len(sig | other) >= threshold:
            return True
    return False


def deduped(items: list[str], threshold: float = 0.6) -> list[str]:
    """Return items with near-duplicates removed, keeping the first and the order.

    A lower threshold merges more aggressively; ~0.6 removes clear repeats within one
    piece of feedback, ~0.5 collapses recurring themes aggregated across interviews.
    """
    return deduped_by(items, key=lambda s: s, threshold=threshold)


def deduped_by(items: list[T], key: Callable[[T], str], threshold: float = 0.6) -> list[T]:
    """Like `deduped`, but for objects: compares each item's `key(item)` text and keeps
    the whole item. Items whose key is blank are dropped. An exact-text match is always
    a duplicate, even when the item is all stopwords and has an empty signature."""
    kept: list[T] = []
    signatures: list[frozenset[str]] = []
    seen: set[str] = set()
    for item in items:
        text = key(item).strip()
        if not text:
            continue
        norm = _norm(text)
        if norm in seen:
            continue
        signature = _signature(text)
        if _is_duplicate(signature, signatures, threshold):
            continue
        kept.append(item)
        signatures.append(signature)
        seen.add(norm)
    return kept
