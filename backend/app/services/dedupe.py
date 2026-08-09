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


def _similarity(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def deduped(items: list[str], threshold: float = 0.6) -> list[str]:
    """Return items with near-duplicates removed, keeping the first and the order.

    A lower threshold merges more aggressively; ~0.6 removes clear repeats within one
    piece of feedback, ~0.35 collapses recurring themes aggregated across interviews.
    """
    return deduped_by(items, key=lambda s: s, threshold=threshold)


def deduped_by(items: list[T], key: Callable[[T], str], threshold: float = 0.6) -> list[T]:
    """Like `deduped`, but for objects: compares each item's `key(item)` text and keeps
    the whole item. Items whose key is blank are dropped."""
    kept: list[T] = []
    signatures: list[frozenset[str]] = []
    for item in items:
        text = key(item).strip()
        if not text:
            continue
        signature = _signature(text)
        if any(_similarity(signature, other) >= threshold for other in signatures):
            continue
        kept.append(item)
        signatures.append(signature)
    return kept
