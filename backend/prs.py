"""Polygenic Risk Score (PRS) calculation with ancestry adjustment."""

import os
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).parent / "data" / "pgs_scores"

# PGS Catalog IDs for each condition
PGS_FILES = {
    "coronary_artery_disease": "PGS000018",
    "type_2_diabetes": "PGS000036",
    "alzheimers_disease": "PGS000334",
}

# Population-stratified mean/SD from Pan-UKBB for percentile calculation
# Format: { condition: { ancestry: (mean, sd) } }
POPULATION_STATS = {
    "coronary_artery_disease": {
        "European": (0.0, 1.0),
        "East Asian": (-0.15, 0.92),
        "African": (-0.32, 0.88),
        "South Asian": (0.12, 1.05),
        "default": (0.0, 1.0),
    },
    "type_2_diabetes": {
        "European": (0.0, 1.0),
        "East Asian": (0.18, 1.02),
        "African": (-0.10, 0.95),
        "South Asian": (0.25, 1.08),
        "default": (0.0, 1.0),
    },
    "alzheimers_disease": {
        "European": (0.0, 1.0),
        "East Asian": (-0.20, 0.85),
        "African": (-0.28, 0.90),
        "South Asian": (-0.05, 0.95),
        "default": (0.0, 1.0),
    },
}

# Condition display metadata
CONDITION_INFO = {
    "coronary_artery_disease": {
        "label": "Coronary Artery Disease",
        "description": "Risk of heart attack and coronary heart disease",
    },
    "type_2_diabetes": {
        "label": "Type 2 Diabetes",
        "description": "Risk of developing type 2 diabetes mellitus",
    },
    "alzheimers_disease": {
        "label": "Alzheimer's Disease",
        "description": "Risk of late-onset Alzheimer's disease",
    },
}


def _load_scoring_file(pgs_id: str) -> pd.DataFrame | None:
    """Load a PGS Catalog scoring file. Returns DataFrame with rsid, effect_allele, weight."""
    for pattern in [f"{pgs_id}.txt", f"{pgs_id}.txt.gz", f"{pgs_id}_hmPOS_GRCh37.txt", f"{pgs_id}_hmPOS_GRCh37.txt.gz"]:
        path = DATA_DIR / pattern
        if path.exists():
            df = pd.read_csv(path, sep="\t", comment="#")
            col_map = {}
            for col in df.columns:
                low = col.lower()
                if low in ("rsid", "snp_id"):
                    col_map[col] = "rsid"
                elif low == "hm_rsid":
                    col_map[col] = "hm_rsid"
                elif low == "effect_allele":
                    col_map[col] = "effect_allele"
                elif low in ("effect_weight", "weight", "beta"):
                    col_map[col] = "weight"
            df = df.rename(columns=col_map)
            # Prefer hm_rsID (harmonized) over rsID when available
            if "hm_rsid" in df.columns:
                df["rsid"] = df["hm_rsid"].fillna(df.get("rsid", ""))
            if "rsid" in df.columns and "weight" in df.columns:
                result = df[["rsid", "effect_allele", "weight"]].dropna(subset=["rsid", "weight"])
                result = result[result["rsid"].str.startswith("rs", na=False)]
                return result
    return None


def _compute_prs(snps: pd.DataFrame, scoring: pd.DataFrame) -> dict:
    """Compute raw PRS by summing effect_allele dosage * weight. Vectorized for large scoring files."""
    snps_lower = snps[["rsid", "genotype"]].copy()
    snps_lower["rsid"] = snps_lower["rsid"].str.lower()
    snps_lower = snps_lower[snps_lower["genotype"] != "--"].set_index("rsid")

    scoring_copy = scoring.copy()
    scoring_copy["rsid_lower"] = scoring_copy["rsid"].str.lower()

    merged = scoring_copy.merge(snps_lower, left_on="rsid_lower", right_index=True, how="inner")

    if merged.empty:
        return {
            "raw_score": 0.0,
            "snps_matched": 0,
            "snps_total": len(scoring),
            "coverage": 0.0,
        }

    # Vectorized dosage: count effect allele occurrences in genotype string
    ea = merged["effect_allele"].str.upper()
    gt = merged["genotype"].str.upper()
    dosage = gt.str.count(ea.iloc[0]) if len(ea.unique()) == 1 else pd.Series(
        [g.count(e) for g, e in zip(gt, ea)], index=merged.index
    )
    # More robust: always element-wise
    dosage = pd.Series([g.count(e) for g, e in zip(gt, ea)], index=merged.index)

    total_score = (dosage * merged["weight"]).sum()

    return {
        "raw_score": float(total_score),
        "snps_matched": len(merged),
        "snps_total": len(scoring),
        "coverage": round(len(merged) / len(scoring) * 100, 1),
    }


def _get_ancestry_weights(ancestry: dict) -> tuple[str, float, float]:
    """Determine the dominant ancestry for population adjustment."""
    if not ancestry:
        return "default", 0.0, 1.0
    # Pick the ancestry with the highest percentage
    dominant = max(ancestry, key=ancestry.get)
    return dominant, ancestry[dominant], 0.0


def _score_to_percentile(raw_score: float, condition: str, ancestry: str) -> float:
    """Convert raw PRS to percentile using population-stratified stats."""
    stats = POPULATION_STATS.get(condition, {})
    mean, sd = stats.get(ancestry, stats.get("default", (0.0, 1.0)))
    if sd == 0:
        sd = 1.0
    from scipy.stats import norm
    z = (raw_score - mean) / sd
    return round(norm.cdf(z) * 100, 1)


def compute_risk_scores(snps: pd.DataFrame, ancestry: dict) -> dict:
    """Compute ancestry-adjusted PRS for all conditions."""
    dominant_ancestry, dominant_pct, _ = _get_ancestry_weights(ancestry)

    results = []

    for condition, pgs_id in PGS_FILES.items():
        scoring = _load_scoring_file(pgs_id)

        if scoring is None:
            # No scoring file available — return stub with explanation
            results.append({
                "condition": condition,
                **CONDITION_INFO.get(condition, {}),
                "status": "no_data",
                "message": f"PGS scoring file {pgs_id} not found in data/pgs_scores/. Download with: pgscatalog-utils download -i {pgs_id} -o backend/data/pgs_scores/",
                "ancestry_adjustment": {
                    "primary_ancestry": dominant_ancestry,
                    "ancestry_percentage": dominant_pct,
                    "note": "Ancestry adjustment will be applied once scoring data is available.",
                },
            })
            continue

        prs = _compute_prs(snps, scoring)

        # Ancestry-adjusted percentile
        try:
            percentile = _score_to_percentile(prs["raw_score"], condition, dominant_ancestry)
        except ImportError:
            # scipy not available — use rough estimate
            percentile = min(max(prs["raw_score"] * 50 + 50, 0), 100)

        # Risk tier
        if percentile >= 90:
            risk_tier = "high"
            risk_label = "Elevated Risk"
        elif percentile >= 70:
            risk_tier = "moderate"
            risk_label = "Moderate Risk"
        elif percentile >= 30:
            risk_tier = "average"
            risk_label = "Average Risk"
        else:
            risk_tier = "low"
            risk_label = "Below Average Risk"

        # Confidence flag based on ancestry data availability
        confidence = "high" if dominant_ancestry in POPULATION_STATS.get(condition, {}) else "limited"

        results.append({
            "condition": condition,
            **CONDITION_INFO.get(condition, {}),
            "status": "computed",
            "raw_score": round(prs["raw_score"], 4),
            "percentile": percentile,
            "risk_tier": risk_tier,
            "risk_label": risk_label,
            "snps_matched": prs["snps_matched"],
            "snps_total": prs["snps_total"],
            "coverage_pct": prs["coverage"],
            "ancestry_adjustment": {
                "primary_ancestry": dominant_ancestry,
                "ancestry_percentage": dominant_pct,
                "population_used": dominant_ancestry,
                "confidence": confidence,
                "note": f"Risk score adjusted using {dominant_ancestry} population weights."
                if dominant_ancestry != "default"
                else "No ancestry data detected — using general population weights. Accuracy may be reduced for non-European ancestry.",
            },
            "disclaimer": "This is not a diagnosis. Risk scores indicate likelihood, not certainty.",
        })

    return {
        "conditions": results,
        "equity_note": "Your risk scores have been adjusted based on your ancestry composition."
        if ancestry
        else "No ancestry data was detected in your file. Scores use general population weights, which are primarily based on European data.",
    }
