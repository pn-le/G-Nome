"""
Culture resolution — dropdown first, ancestry fallback.

Primary path: the user picks their culture from a dropdown in the mobile app
(AncestryDNA exports usually carry no ancestry composition, so we cannot
infer reliably). The resolved string MUST be a key the corpus actually has
documents for, otherwise retrieval returns nothing.

Order of precedence:
    1. profile.culture (user dropdown selection) — accepted as-is if it matches
       a known culture in CULTURE_FOODS.
    2. profile.ancestry top key — used only when no dropdown selection.
    3. Macro-region fallback via CULTURE_HIERARCHY.
    4. Final default: "European" (most general corpus, least likely to mislead).
"""

from __future__ import annotations

from cultural_rag.config import CULTURE_FOODS, CULTURE_HIERARCHY
from cultural_rag.schemas import GenomicProfile

KNOWN_CULTURES = set(CULTURE_FOODS.keys())
DEFAULT_CULTURE = "European"


def resolve_culture(profile: GenomicProfile) -> str:
    """Return a culture string guaranteed to exist in the corpus."""
    # 1. User dropdown wins
    if profile.culture and profile.culture in KNOWN_CULTURES:
        return profile.culture

    # 2. Map known but sub-cuisine selections via hierarchy
    if profile.culture and profile.culture in CULTURE_HIERARCHY:
        mapped = CULTURE_HIERARCHY[profile.culture]
        if mapped in KNOWN_CULTURES:
            return mapped

    # 3. Infer from ancestry composition (top key)
    if profile.ancestry:
        top = max(profile.ancestry, key=profile.ancestry.get)
        if top in KNOWN_CULTURES:
            return top
        if top in CULTURE_HIERARCHY:
            mapped = CULTURE_HIERARCHY[top]
            if mapped in KNOWN_CULTURES:
                return mapped

    # 4. Last-resort default
    return DEFAULT_CULTURE
