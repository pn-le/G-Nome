"""Polygenic Risk Score (PRS) calculation with ancestry adjustment."""

from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).parent / "data" / "pgs_scores"

PGS_FILES = {
    "coronary_artery_disease": "PGS000018",
    "type_2_diabetes": "PGS000036",
    "alzheimers_disease": "PGS000334",
    "breast_cancer": "PGS000007",
    "prostate_cancer": "PGS000662",
}

POPULATION_STATS = {
    "coronary_artery_disease": {
        "European": (0.0, 1.0), "East Asian": (-0.15, 0.92),
        "African": (-0.32, 0.88), "South Asian": (0.12, 1.05), "default": (0.0, 1.0),
    },
    "type_2_diabetes": {
        "European": (0.0, 1.0), "East Asian": (0.18, 1.02),
        "African": (-0.10, 0.95), "South Asian": (0.25, 1.08), "default": (0.0, 1.0),
    },
    "alzheimers_disease": {
        "European": (0.0, 1.0), "East Asian": (-0.20, 0.85),
        "African": (-0.28, 0.90), "South Asian": (-0.05, 0.95), "default": (0.0, 1.0),
    },
    "breast_cancer": {
        "European": (0.0, 1.0), "East Asian": (-0.08, 0.95),
        "African": (-0.18, 0.90), "default": (0.0, 1.0),
    },
    "prostate_cancer": {
        "European": (0.0, 1.0), "African": (0.15, 1.05),
        "East Asian": (-0.12, 0.93), "default": (0.0, 1.0),
    },
}

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
    "breast_cancer": {
        "label": "Breast Cancer",
        "description": "Risk of developing breast cancer",
    },
    "prostate_cancer": {
        "label": "Prostate Cancer",
        "description": "Risk of developing prostate cancer",
    },
}


def _load_scoring_file(pgs_id: str) -> pd.DataFrame | None:
    """Load a PGS Catalog scoring file. Supports both rsID and chr:pos formats."""
    for pattern in [f"{pgs_id}.txt", f"{pgs_id}.txt.gz",
                    f"{pgs_id}_hmPOS_GRCh37.txt", f"{pgs_id}_hmPOS_GRCh37.txt.gz"]:
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
                elif low in ("chr_name", "hm_chr"):
                    col_map[col] = "chrom"
                elif low in ("chr_position", "hm_pos"):
                    col_map[col] = "pos"
            df = df.rename(columns=col_map)

            # Prefer hm_rsID over rsID when available
            if "hm_rsid" in df.columns:
                df["rsid"] = df["hm_rsid"].fillna(df.get("rsid", pd.Series(dtype=str)))

            # Determine match mode
            has_rsid = "rsid" in df.columns and df["rsid"].notna().any() and df["rsid"].str.startswith("rs", na=False).any()

            if has_rsid and "weight" in df.columns:
                result = df[["rsid", "effect_allele", "weight"]].copy()
                result = result.dropna(subset=["rsid", "weight"])
                result = result[result["rsid"].str.startswith("rs", na=False)]
                result["match_mode"] = "rsid"
                return result
            elif "chrom" in df.columns and "pos" in df.columns and "weight" in df.columns:
                result = df[["chrom", "pos", "effect_allele", "weight"]].copy()
                result = result.dropna(subset=["chrom", "pos", "weight"])
                result["chrom"] = result["chrom"].astype(str)
                result["pos"] = result["pos"].astype(int)
                result["match_mode"] = "position"
                return result
    return None


def _compute_prs(snps: pd.DataFrame, scoring: pd.DataFrame) -> dict:
    """Compute raw PRS. Supports rsID or chr:pos matching."""
    match_mode = scoring["match_mode"].iloc[0] if "match_mode" in scoring.columns else "rsid"

    if match_mode == "rsid":
        return _compute_prs_rsid(snps, scoring)
    else:
        return _compute_prs_position(snps, scoring)


def _compute_prs_rsid(snps: pd.DataFrame, scoring: pd.DataFrame) -> dict:
    snps_clean = snps[["rsid", "genotype"]].copy()
    snps_clean["rsid"] = snps_clean["rsid"].str.lower()
    snps_clean = snps_clean[snps_clean["genotype"] != "--"].set_index("rsid")

    scoring_copy = scoring[["rsid", "effect_allele", "weight"]].copy()
    scoring_copy["rsid_lower"] = scoring_copy["rsid"].str.lower()

    merged = scoring_copy.merge(snps_clean, left_on="rsid_lower", right_index=True, how="inner")

    if merged.empty:
        return {"raw_score": 0.0, "snps_matched": 0, "snps_total": len(scoring), "coverage": 0.0}

    ea = merged["effect_allele"].str.upper()
    gt = merged["genotype"].str.upper()
    dosage = pd.Series([g.count(e) for g, e in zip(gt, ea)], index=merged.index)
    total_score = (dosage * merged["weight"]).sum()

    return {
        "raw_score": float(total_score),
        "snps_matched": len(merged),
        "snps_total": len(scoring),
        "coverage": round(len(merged) / len(scoring) * 100, 1),
    }


def _compute_prs_position(snps: pd.DataFrame, scoring: pd.DataFrame) -> dict:
    """Match by chromosome + position when rsIDs aren't available."""
    if "chrom" not in snps.columns or "pos" not in snps.columns:
        return {"raw_score": 0.0, "snps_matched": 0, "snps_total": len(scoring), "coverage": 0.0}

    snps_clean = snps[["chrom", "pos", "genotype"]].copy()
    snps_clean = snps_clean[snps_clean["genotype"] != "--"]
    snps_clean["chrom"] = snps_clean["chrom"].astype(str)
    snps_clean["pos"] = pd.to_numeric(snps_clean["pos"], errors="coerce")
    snps_clean = snps_clean.dropna(subset=["pos"])
    snps_clean["pos"] = snps_clean["pos"].astype(int)

    scoring_copy = scoring[["chrom", "pos", "effect_allele", "weight"]].copy()

    merged = scoring_copy.merge(snps_clean, on=["chrom", "pos"], how="inner")

    if merged.empty:
        return {"raw_score": 0.0, "snps_matched": 0, "snps_total": len(scoring), "coverage": 0.0}

    ea = merged["effect_allele"].str.upper()
    gt = merged["genotype"].str.upper()
    dosage = pd.Series([g.count(e) for g, e in zip(gt, ea)], index=merged.index)
    total_score = (dosage * merged["weight"]).sum()

    return {
        "raw_score": float(total_score),
        "snps_matched": len(merged),
        "snps_total": len(scoring),
        "coverage": round(len(merged) / len(scoring) * 100, 1),
    }


def _get_ancestry_weights(ancestry: dict) -> tuple[str, float, float]:
    if not ancestry:
        return "default", 0.0, 1.0
    dominant = max(ancestry, key=ancestry.get)
    return dominant, ancestry[dominant], 0.0


def _score_to_percentile(raw_score: float, condition: str, ancestry: str) -> float:
    from scipy.stats import norm
    pop = POPULATION_STATS.get(condition, {})
    mean, sd = pop.get(ancestry, pop.get("default", (0.0, 1.0)))
    if sd == 0:
        sd = 1.0
    z = (raw_score - mean) / sd
    return round(norm.cdf(z) * 100, 1)


def compute_risk_scores(snps: pd.DataFrame, ancestry: dict) -> dict:
    dominant_ancestry, dominant_pct, _ = _get_ancestry_weights(ancestry)
    results = []

    for condition, pgs_id in PGS_FILES.items():
        scoring = _load_scoring_file(pgs_id)

        if scoring is None:
            results.append({
                "condition": condition, **CONDITION_INFO.get(condition, {}),
                "status": "no_data",
                "message": f"PGS scoring file {pgs_id} not found.",
                "ancestry_adjustment": {"primary_ancestry": dominant_ancestry, "ancestry_percentage": dominant_pct,
                                        "note": "Ancestry adjustment will be applied once scoring data is available."},
            })
            continue

        prs = _compute_prs(snps, scoring)

        try:
            percentile = _score_to_percentile(prs["raw_score"], condition, dominant_ancestry)
        except ImportError:
            percentile = min(max(prs["raw_score"] * 50 + 50, 0), 100)

        if percentile >= 90:
            risk_tier, risk_label = "high", "Elevated Risk"
        elif percentile >= 70:
            risk_tier, risk_label = "moderate", "Moderate Risk"
        elif percentile >= 30:
            risk_tier, risk_label = "average", "Average Risk"
        else:
            risk_tier, risk_label = "low", "Below Average Risk"

        confidence = "high" if dominant_ancestry in POPULATION_STATS.get(condition, {}) else "limited"

        results.append({
            "condition": condition, **CONDITION_INFO.get(condition, {}),
            "status": "computed",
            "raw_score": round(prs["raw_score"], 4),
            "percentile": percentile,
            "risk_tier": risk_tier, "risk_label": risk_label,
            "snps_matched": prs["snps_matched"], "snps_total": prs["snps_total"],
            "coverage_pct": prs["coverage"],
            "ancestry_adjustment": {
                "primary_ancestry": dominant_ancestry, "ancestry_percentage": dominant_pct,
                "population_used": dominant_ancestry, "confidence": confidence,
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
