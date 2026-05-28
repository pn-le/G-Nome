"""
Schema adapter — maps the real upstream genomic payload into
canonical GenomicProfile for the Cultural RAG module.

Also contains the output CulturalRecommendations schema.

The adapter is the ONLY place that knows the upstream payload shape.
When the genomic team changes their output, you change adapt_upstream() only.

Usage:
    from cultural_rag.schemas import adapt_upstream, GenomicProfile
    profile = adapt_upstream(payload, culture="East Asian")
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ===================================================================
# Canonical internal models
# ===================================================================

class MetabolicRisk(BaseModel):
    """A single computed disease risk from the upstream ML pipeline."""
    condition: str
    risk_tier: str  # "low", "moderate", "high"
    raw_score: float = 0.0
    percentile: float = 0.0
    description: str = ""


class CarrierHit(BaseModel):
    """A carrier status finding (only included when detected)."""
    gene: str
    condition: str
    status: str
    detail: str = ""


class NutritionTrait(BaseModel):
    """A nutrition/trait extracted from report prose."""
    trait: str
    detail: str
    recommendation: str = ""


class GenomicProfile(BaseModel):
    """
    Canonical genomic profile consumed by the Cultural RAG pipeline.

    Culture is set by user dropdown (primary path) — not inferred from ancestry,
    because AncestryDNA exports typically contain empty ancestry data.
    """
    ancestry: dict = Field(default_factory=dict)
    culture: str = ""  # Set by user dropdown
    culture_confirmed_by_user: bool = True  # Primary path: user tells us
    metabolic_risks: list[MetabolicRisk] = Field(default_factory=list)
    carrier_hits: list[CarrierHit] = Field(default_factory=list)
    nutrition_traits: list[NutritionTrait] = Field(default_factory=list)
    flagged_drugs: list[str] = Field(default_factory=list)
    metabolizer_status: dict[str, str] = Field(default_factory=dict)
    report_prose: str = ""  # Full report text for PGX prose extraction


# ===================================================================
# Output schema
# ===================================================================

class DietaryRecommendation(BaseModel):
    condition: str
    advice: str
    culturally_relevant_foods: list[str] = Field(default_factory=list)
    foods_to_limit: list[str] = Field(default_factory=list)
    evidence_source: list[str] = Field(default_factory=list)


class DrugFoodInteraction(BaseModel):
    drug: str
    interaction: str
    cultural_note: str = ""
    evidence_source: list[str] = Field(default_factory=list)


class CulturalRecommendations(BaseModel):
    """Output schema handed to the report/PDF layer."""
    cultural_profile: str
    culture_confirmed_by_user: bool = True
    dietary_recommendations: list[DietaryRecommendation] = Field(default_factory=list)
    drug_food_interactions: list[DrugFoodInteraction] = Field(default_factory=list)
    cultural_note: str = ""
    disclaimer: str = (
        "Informational only. Not a medical device. "
        "Review with a qualified clinician before any health or medication decisions."
    )


# ===================================================================
# Adapter — maps real upstream payload → GenomicProfile
# ===================================================================

def adapt_upstream(payload: dict, culture: str = "") -> GenomicProfile:
    """
    Map the real upstream genomic payload into our canonical GenomicProfile.

    Args:
        payload: The raw payload from the genomic pipeline (see SAMPLE_PAYLOAD).
        culture: User-selected culture from the dropdown. This is the PRIMARY path
                 because AncestryDNA exports contain empty ancestry.

    Returns:
        GenomicProfile ready for the RAG pipeline.
    """
    parse = payload.get("parse", {})
    report = payload.get("report", {})

    # Ancestry — usually empty for AncestryDNA exports
    ancestry = parse.get("ancestry", {})

    # Metabolic risks — filter to status=="computed" only
    conditions = report.get("disease_risk", {}).get("conditions", [])
    metabolic_risks = []
    for cond in conditions:
        if cond.get("status") == "computed":
            metabolic_risks.append(MetabolicRisk(
                condition=cond.get("condition", "Unknown"),
                risk_tier=cond.get("risk_tier", "unknown"),
                raw_score=cond.get("raw_score", 0.0),
                percentile=cond.get("percentile", 0.0),
                description=cond.get("description", ""),
            ))

    # Carrier hits — only those with detected variants
    carrier_results = report.get("carrier_status", {}).get("results", [])
    carrier_hits = []
    for result in carrier_results:
        if result.get("status") != "not_detected":
            carrier_hits.append(CarrierHit(
                gene=result.get("gene", ""),
                condition=result.get("condition", ""),
                status=result.get("status", ""),
                detail=result.get("detail", ""),
            ))

    # Report prose — for PGX extraction
    report_prose = report.get("report_text", {}).get("full_text", "")

    return GenomicProfile(
        ancestry=ancestry,
        culture=culture,
        culture_confirmed_by_user=bool(culture),
        metabolic_risks=metabolic_risks,
        carrier_hits=carrier_hits,
        report_prose=report_prose,
    )


# ===================================================================
# Sample payload — trimmed from the real sample for testing
# ===================================================================

SAMPLE_PAYLOAD = {
    "parse": {
        "source": "AncestryDNA",
        "ancestry": {},
        "snp_count": 673826,
        "session_id": "744282b80d18",
        "chromosomes": 26,
    },
    "report": {
        "report_text": {
            "full_text": (
                "## Pharmacogenomics Summary\n"
                "Your pharmacogenomics results indicate how your body might respond to certain medications. "
                "The analysis of your genetic data shows that you are a normal metabolizer for several genes, "
                "including CYP2C19, CYP2C9, DPYD, and TPMT. This means that you are likely to metabolize "
                "drugs that are processed by these genes in a typical way. However, it's essential to note "
                "that the CYP2D6 gene, which affects the metabolism of certain medications like codeine, "
                "tramadol, and some antidepressants, could not be reliably determined from your SNP array data. "
                "For the genes that were tested, there are no specific drug flags or warnings.\n\n"
                "## Nutrition & Traits\n"
                "Your nutrition and traits report offers insights into how your genetics might influence your "
                "response to certain nutrients and dietary components. The results show that you are a slow "
                "metabolizer of caffeine, suggesting that you might want to limit your caffeine intake to "
                "1-2 cups per day. Additionally, your genetic profile indicates reduced vitamin D absorption, "
                "which might necessitate a supplement of 1,000-2,000 IU daily. There's also a high risk "
                "indicated for celiac disease based on your HLA-DQ2.5 alleles."
            ),
            "llm_generated": True,
        },
        "disease_risk": {
            "conditions": [
                {
                    "label": "Coronary Artery Disease",
                    "status": "no_data",
                    "message": "PGS scoring file PGS000018 not found.",
                    "condition": "coronary_artery_disease",
                },
                {
                    "status": "computed",
                    "condition": "Coronary Artery Disease (ML Enhanced)",
                    "raw_score": 0.0951,
                    "risk_tier": "low",
                    "percentile": 9.5,
                    "risk_label": "Below Average Risk",
                    "description": "Risk prediction powered by an Elastic Net ML model.",
                    "is_ml_model": True,
                },
                {
                    "status": "computed",
                    "condition": "Type 2 Diabetes (ML Enhanced)",
                    "raw_score": 0.1359,
                    "risk_tier": "low",
                    "percentile": 13.6,
                    "risk_label": "Below Average Risk",
                    "description": "Risk prediction powered by an Elastic Net ML model.",
                    "is_ml_model": True,
                },
                {
                    "status": "computed",
                    "condition": "Breast Cancer (ML Enhanced)",
                    "raw_score": 0.0006,
                    "risk_tier": "low",
                    "percentile": 0.1,
                    "risk_label": "Below Average Risk",
                    "description": "Risk prediction powered by an Elastic Net ML model.",
                    "is_ml_model": True,
                },
            ],
            "equity_note": "No ancestry data was detected in your file.",
        },
        "carrier_status": {
            "results": [
                {
                    "gene": "BRCA1",
                    "status": "not_detected",
                    "condition": "Hereditary Breast/Ovarian Cancer",
                    "detail": "No pathogenic variants detected.",
                },
                {
                    "gene": "HBB",
                    "status": "pathogenic_detected",
                    "condition": "Sickle Cell Disease/Beta-Thalassemia",
                    "detail": "Two copies of a pathogenic variant detected.",
                },
            ],
        },
    },
}
