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

from cultural_rag.config import CULTURE_FOODS, CULTURE_HIERARCHY, VERIFY_MODEL
from cultural_rag.schemas import GenomicProfile
from cultural_rag.runtime import async_nebius_client

KNOWN_CULTURES = set(CULTURE_FOODS.keys())
DEFAULT_CULTURE = "European"


async def _classify_culture_with_llm(user_culture: str) -> str:
    """Use the verify model to map a custom input to the closest KNOWN_CULTURE."""
    if not async_nebius_client:
        return ""
    
    valid_list = ", ".join(sorted(KNOWN_CULTURES))
    prompt = f"""Map the user-provided cuisine/ethnicity "{user_culture}" to exactly ONE of the following supported culture regions:
{valid_list}

RULES:
1. Output ONLY the exact matching name from the list above. No prose, no punctuation.
2. If it clearly falls under one of those regions (e.g. "Greek" -> "European", "Ethiopian" -> "African", "Moroccan" -> "Middle Eastern"), output that region.
3. If it is completely unrecognized, output "Unknown".
"""
    try:
        resp = await async_nebius_client.chat.completions.create(
            model=VERIFY_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=10,
        )
        ans = (resp.choices[0].message.content or "").strip()
        # Sometimes the model adds quotes or a period
        ans = ans.strip("'\".").strip()
        if ans in KNOWN_CULTURES:
            return ans
    except Exception as e:
        print(f"[resolve_culture] LLM classify failed: {e}")
        pass
    return ""


async def resolve_culture(profile: GenomicProfile) -> str:
    """Return a culture string guaranteed to exist in the corpus."""
    # 1. User dropdown wins
    if profile.culture and profile.culture in KNOWN_CULTURES:
        return profile.culture

    # 2. Map known but sub-cuisine selections via hierarchy
    if profile.culture and profile.culture in CULTURE_HIERARCHY:
        mapped = CULTURE_HIERARCHY[profile.culture]
        if mapped in KNOWN_CULTURES:
            return mapped

    # 3. Use LLM to classify custom/unknown user input
    if profile.culture:
        llm_mapped = await _classify_culture_with_llm(profile.culture)
        if llm_mapped in KNOWN_CULTURES:
            return llm_mapped

    # 4. Infer from ancestry composition (top key)
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
