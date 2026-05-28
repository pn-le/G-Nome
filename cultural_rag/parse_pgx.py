"""
Parse pharmacogenomics, metabolizer status, and nutrition traits
from the upstream report's prose text.

The real payload from teammates has drug/nutrition data ONLY in prose,
not structured fields. This module extracts it via LLM.

Usage:
    from cultural_rag.parse_pgx import extract_pgx_from_prose, build_profile
"""

from __future__ import annotations
import json
from cultural_rag.config import nebius_client, GEN_MODEL
from cultural_rag.schemas import (
    GenomicProfile, NutritionTrait, adapt_upstream,
)


PGX_EXTRACTION_PROMPT = """\
You are a pharmacogenomics data extractor. Given a clinical report text,
extract structured data. Respond with ONLY a JSON object (no markdown, no explanation):

{
  "flagged_drugs": ["drug1", "drug2"],
  "metabolizer_status": {
    "CYP2C19": "normal_metabolizer",
    "CYP2C9": "normal_metabolizer",
    "CYP2D6": "undetermined"
  },
  "nutrition_traits": [
    {
      "trait": "caffeine metabolism",
      "detail": "slow metabolizer",
      "recommendation": "limit to 1-2 cups per day"
    }
  ]
}

Rules:
- flagged_drugs: list ONLY drugs explicitly flagged as requiring dose adjustment or avoidance.
  If the text says "no specific drug flags", return an empty list [].
- metabolizer_status: extract gene→status for any gene mentioned.
  Valid statuses: "poor_metabolizer", "intermediate_metabolizer", "normal_metabolizer",
  "rapid_metabolizer", "ultra_rapid_metabolizer", "undetermined".
  If a gene "could not be reliably determined", set it to "undetermined".
- nutrition_traits: extract any nutrition/dietary traits mentioned (caffeine, vitamin D,
  lactose, celiac risk, alcohol flush, folate, etc.).
"""


def extract_pgx_from_prose(prose: str) -> dict:
    """
    Extract pharmacogenomics and nutrition data from report prose.

    Args:
        prose: The full_text from report.report_text.

    Returns:
        Dict with keys: flagged_drugs, metabolizer_status, nutrition_traits.
    """
    if not prose:
        return {
            "flagged_drugs": [],
            "metabolizer_status": {},
            "nutrition_traits": [],
        }

    if not nebius_client:
        # Fallback: basic keyword extraction without LLM
        return _keyword_fallback(prose)

    try:
        response = nebius_client.chat.completions.create(
            model=GEN_MODEL,
            messages=[
                {"role": "system", "content": PGX_EXTRACTION_PROMPT},
                {"role": "user", "content": prose},
            ],
            temperature=0.1,
            max_tokens=500,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()

        return json.loads(raw)

    except (json.JSONDecodeError, Exception):
        return _keyword_fallback(prose)


def _keyword_fallback(prose: str) -> dict:
    """
    Basic keyword extraction from prose when LLM is unavailable.
    Not perfect, but gives something to work with offline.
    """
    lower = prose.lower()
    result = {
        "flagged_drugs": [],
        "metabolizer_status": {},
        "nutrition_traits": [],
    }

    # Metabolizer status
    for gene in ["cyp2c19", "cyp2c9", "cyp2d6", "dpyd", "tpmt", "cyp1a2"]:
        if gene in lower:
            if f"{gene}" in lower and "normal metabolizer" in lower:
                result["metabolizer_status"][gene.upper()] = "normal_metabolizer"
            elif "poor metabolizer" in lower:
                result["metabolizer_status"][gene.upper()] = "poor_metabolizer"
            elif "could not be reliably determined" in lower or "undetermined" in lower:
                result["metabolizer_status"][gene.upper()] = "undetermined"

    # Nutrition traits
    if "slow metabolizer of caffeine" in lower or "slow metabolizer" in lower and "caffeine" in lower:
        result["nutrition_traits"].append({
            "trait": "caffeine metabolism",
            "detail": "slow metabolizer (CYP1A2 AC/CC)",
            "recommendation": "Limit caffeine to 1-2 cups per day",
        })

    if "reduced vitamin d absorption" in lower or "vitamin d" in lower:
        result["nutrition_traits"].append({
            "trait": "vitamin D absorption",
            "detail": "reduced absorption (GC rs2282679 variant)",
            "recommendation": "Supplement 1,000-2,000 IU vitamin D3 daily",
        })

    if "celiac" in lower or "hla-dq2" in lower:
        result["nutrition_traits"].append({
            "trait": "celiac disease risk",
            "detail": "high risk (HLA-DQ2.5 alleles)",
            "recommendation": "Discuss with doctor for celiac screening",
        })

    return result


def build_profile(payload: dict, culture: str) -> GenomicProfile:
    """
    Full pipeline: adapt upstream payload → enrich with PGX prose extraction.

    This is the function your api.py calls.

    Args:
        payload: Raw upstream genomic payload.
        culture: User-selected culture from dropdown.

    Returns:
        Fully enriched GenomicProfile.
    """
    # Step 1: Adapt structured fields
    profile = adapt_upstream(payload, culture=culture)

    # Step 2: Extract PGX and nutrition from prose
    pgx_data = extract_pgx_from_prose(profile.report_prose)

    # Enrich profile with extracted data
    profile.flagged_drugs = pgx_data.get("flagged_drugs", [])
    profile.metabolizer_status = pgx_data.get("metabolizer_status", {})

    # Convert nutrition traits
    raw_traits = pgx_data.get("nutrition_traits", [])
    for t in raw_traits:
        if isinstance(t, dict):
            profile.nutrition_traits.append(NutritionTrait(
                trait=t.get("trait", ""),
                detail=t.get("detail", ""),
                recommendation=t.get("recommendation", ""),
            ))

    return profile
