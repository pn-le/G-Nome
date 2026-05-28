"""
Generation step — Qwen3 instruct with response_format JSON schema.

Strategy: enforce schema at API level (response_format), then still parse
defensively. On first parse failure, retry once with a tightened prompt.
On a second failure, return a safe empty-with-disclaimer fallback so the
report layer never sees a 500.
"""

from __future__ import annotations
import json
import re
from typing import Any

from pydantic import ValidationError

from cultural_rag.schemas import GenomicProfile, CulturalRecommendations
from cultural_rag.runtime import async_nebius_client, GEN_MODEL


GEN_TEMPERATURE = 0.3
MAX_TOKENS = 2048


SYSTEM_PROMPT = """You are G-Nome's cultural nutrition advisor.

Your job: take a user's genomic profile and a set of retrieved nutrition
documents, and produce dietary + drug-food-interaction guidance tailored to
their culture.

HARD RULES:
1. Every dietary_recommendation and drug_food_interaction MUST cite at least
   one evidence_source taken verbatim from the retrieved context (USDA fdcId
   or PubMed PMID). Do NOT invent sources.
2. Name actual culturally familiar foods — not generic categories.
3. Only make claims supported by the retrieved context. If the context does
   not support a claim, omit it.
4. Never give definitive diagnoses or "stop taking X" directives.
5. Always include the disclaimer field.
6. Output MUST be valid JSON matching the provided schema. No prose outside
   the JSON object. No markdown fences.
"""


def _build_context_block(docs: list[dict[str, Any]]) -> str:
    """Format retrieved docs into a numbered context block for the prompt."""
    if not docs:
        return "(no documents retrieved — produce an empty recommendations list and explain in cultural_note)"
    lines = []
    for i, d in enumerate(docs, start=1):
        src = d.get("evidence_source", "unknown")
        cond = d.get("condition", "")
        content = d.get("content", "").strip()
        lines.append(f"[{i}] culture={d.get('culture','')} condition={cond} source={src}\n{content}")
    return "\n\n".join(lines)


def _build_user_prompt(
    profile: GenomicProfile,
    culture: str,
    docs: list[dict[str, Any]],
) -> str:
    risk_lines = [
        f"  - {r.condition} ({r.risk_tier}, {r.percentile:.0f}th percentile)"
        for r in profile.metabolic_risks
    ] or ["  - (none flagged)"]
    carrier_lines = [
        f"  - {c.gene}: {c.condition} ({c.status})"
        for c in profile.carrier_hits
    ] or ["  - (none flagged)"]
    drug_line = ", ".join(profile.flagged_drugs) or "(none flagged)"

    return f"""USER GENOMIC PROFILE
Culture (resolved): {culture}
Confirmed by user: {profile.culture_confirmed_by_user}

Metabolic risks:
{chr(10).join(risk_lines)}

Carrier hits:
{chr(10).join(carrier_lines)}

Flagged drugs: {drug_line}

RETRIEVED CONTEXT
{_build_context_block(docs)}

TASK
Produce a CulturalRecommendations JSON object. For each metabolic risk and
each flagged drug that the retrieved context supports, emit one entry.
Tie every recommendation's evidence_source to a source ID from the context
above. If no retrieved doc supports a claim, omit that claim."""


def _strip_fences(text: str) -> str:
    """Remove ```json ... ``` fences if present."""
    text = text.strip()
    if text.startswith("```"):
        # remove opening fence (and optional language tag)
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        # remove closing fence
        if text.endswith("```"):
            text = text[: -3]
    return text.strip()


def _parse(raw: str) -> CulturalRecommendations | None:
    """Defensive parse: strip fences, json.loads, pydantic validate."""
    try:
        cleaned = _strip_fences(raw)
        data = json.loads(cleaned)
        return CulturalRecommendations.model_validate(data)
    except (json.JSONDecodeError, ValidationError):
        return None


def _safe_empty(culture: str) -> CulturalRecommendations:
    """Fallback returned when the LLM call or parse repeatedly fails."""
    return CulturalRecommendations(
        cultural_profile=culture,
        culture_confirmed_by_user=True,
        dietary_recommendations=[],
        drug_food_interactions=[],
        cultural_note=(
            "Cultural recommendations could not be generated for this request. "
            "Please try again, or consult a registered dietitian familiar with "
            f"{culture} cuisine."
        ),
    )


async def _call_llm(
    user_prompt: str,
    schema: dict,
) -> str:
    """Make one LLM call. Falls back from json_schema to json_object format
    if the provider rejects strict schema mode."""
    if not async_nebius_client:
        raise RuntimeError("NEBIUS_API_KEY not set — cannot generate")

    try:
        resp = await async_nebius_client.chat.completions.create(
            model=GEN_MODEL,
            temperature=GEN_TEMPERATURE,
            max_tokens=MAX_TOKENS,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "CulturalRecommendations",
                    "schema": schema,
                },
            },
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return resp.choices[0].message.content or ""
    except Exception:
        resp = await async_nebius_client.chat.completions.create(
            model=GEN_MODEL,
            temperature=GEN_TEMPERATURE,
            max_tokens=MAX_TOKENS,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return resp.choices[0].message.content or ""


async def generate_recommendations(
    profile: GenomicProfile,
    culture: str,
    docs: list[dict[str, Any]],
) -> CulturalRecommendations:
    """Run the LLM generation step with one retry on parse failure."""
    schema = CulturalRecommendations.model_json_schema()
    user_prompt = _build_user_prompt(profile, culture, docs)

    raw = await _call_llm(user_prompt, schema)
    parsed = _parse(raw)
    if parsed is not None:
        # Force the cultural_profile to the resolved culture
        parsed.cultural_profile = culture
        parsed.culture_confirmed_by_user = profile.culture_confirmed_by_user
        return parsed

    # Retry once with an explicit "JSON only" reminder
    retry_prompt = user_prompt + "\n\nIMPORTANT: Return ONLY the JSON object. No markdown, no commentary."
    raw = await _call_llm(retry_prompt, schema)
    parsed = _parse(raw)
    if parsed is not None:
        parsed.cultural_profile = culture
        parsed.culture_confirmed_by_user = profile.culture_confirmed_by_user
        return parsed

    return _safe_empty(culture)
