"""Nutrition, trait, and physical appearance SNP analysis."""

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

# --- Nutrition traits (hardcoded — NOT from HIrisPlex) ---

NUTRITION_SNPS = {
    "caffeine_sensitivity": {
        "name": "Caffeine Sensitivity",
        "rsid": "rs762551",
        "gene": "CYP1A2",
        "interpretations": {
            "AA": {"status": "fast", "label": "Fast Metabolizer", "detail": "You process caffeine quickly. Standard coffee intake unlikely to cause jitteriness or sleep disruption."},
            "AC": {"status": "slow", "label": "Slow Metabolizer", "detail": "You metabolize caffeine slowly. High intake may increase heart rate and disrupt sleep. Limit to 1-2 cups/day."},
            "CA": {"status": "slow", "label": "Slow Metabolizer", "detail": "You metabolize caffeine slowly. High intake may increase heart rate and disrupt sleep. Limit to 1-2 cups/day."},
            "CC": {"status": "slow", "label": "Slow Metabolizer", "detail": "You metabolize caffeine slowly. High intake may increase heart rate and disrupt sleep. Limit to 1-2 cups/day."},
        },
    },
    "lactose_tolerance": {
        "name": "Lactose Intolerance",
        "rsid": "rs4988235",
        "gene": "LCT",
        "interpretations": {
            "TT": {"status": "tolerant", "label": "Lactose Tolerant", "detail": "You likely produce lactase into adulthood. Dairy is generally well-tolerated."},
            "CT": {"status": "tolerant", "label": "Likely Lactose Tolerant", "detail": "You likely produce lactase into adulthood. Dairy is generally well-tolerated."},
            "TC": {"status": "tolerant", "label": "Likely Lactose Tolerant", "detail": "You likely produce lactase into adulthood. Dairy is generally well-tolerated."},
            "CC": {"status": "intolerant", "label": "Likely Lactose Intolerant", "detail": "Reduced lactase activity likely. Consider limiting dairy or using lactase supplements."},
        },
    },
    "alcohol_flush": {
        "name": "Alcohol Flush Reaction",
        "rsid": "rs671",
        "gene": "ALDH2",
        "interpretations": {
            "GG": {"status": "normal", "label": "No Flush", "detail": "Normal alcohol metabolism. No genetic predisposition to flushing."},
            "AG": {"status": "mild_flush", "label": "Mild Flush", "detail": "One ALDH2*2 variant. May experience mild flushing. Elevated cancer risk with heavy drinking."},
            "GA": {"status": "mild_flush", "label": "Mild Flush", "detail": "One ALDH2*2 variant. May experience mild flushing. Elevated cancer risk with heavy drinking."},
            "AA": {"status": "flush", "label": "Flush Response", "detail": "Two ALDH2*2 variants. Alcohol causes flushing, nausea, rapid heartbeat. Significantly elevated cancer risk."},
        },
    },
    "vitamin_d": {
        "name": "Vitamin D Absorption",
        "rsid": "rs2282679",
        "gene": "GC",
        "interpretations": {
            "GG": {"status": "normal", "label": "Normal Absorption", "detail": "No genetic reduction in vitamin D transport. Standard sun exposure and diet typically sufficient."},
            "GT": {"status": "slightly_reduced", "label": "Slightly Reduced", "detail": "Mild reduction in vitamin D transport. Consider moderate supplementation in low-sunlight months."},
            "TG": {"status": "slightly_reduced", "label": "Slightly Reduced", "detail": "Mild reduction in vitamin D transport. Consider moderate supplementation in low-sunlight months."},
            "TT": {"status": "reduced", "label": "Reduced Absorption", "detail": "Reduced vitamin D binding protein. Higher deficiency risk. Consider 1,000-2,000 IU daily supplement."},
        },
    },
    "folate_mthfr": {
        "name": "Folate Processing (MTHFR)",
        "rsid": "rs1801133",
        "gene": "MTHFR",
        "interpretations": {
            "CC": {"status": "normal", "label": "Normal Processing", "detail": "Standard folate metabolism. Normal diet provides sufficient folate."},
            "CT": {"status": "slightly_reduced", "label": "Mildly Reduced", "detail": "One MTHFR C677T variant. Methylfolate supplements may work better than standard folic acid."},
            "TC": {"status": "slightly_reduced", "label": "Mildly Reduced", "detail": "One MTHFR C677T variant. Methylfolate supplements may work better than standard folic acid."},
            "TT": {"status": "reduced", "label": "Reduced Processing", "detail": "Two MTHFR C677T variants. Consider methylfolate (not folic acid). Associated with elevated homocysteine."},
        },
    },
    "celiac_risk": {
        "name": "Celiac Disease Risk",
        "rsid": "rs2187668",
        "gene": "HLA-DQA1",
        "interpretations": {
            "TT": {"status": "low", "label": "Lower Risk", "detail": "HLA-DQ2.5 not detected. Lower genetic predisposition to celiac disease."},
            "CT": {"status": "elevated", "label": "Elevated Risk", "detail": "One HLA-DQ2.5 risk allele. Consider testing if you have digestive symptoms with gluten."},
            "TC": {"status": "elevated", "label": "Elevated Risk", "detail": "One HLA-DQ2.5 risk allele. Consider testing if you have digestive symptoms with gluten."},
            "CC": {"status": "high", "label": "High Risk", "detail": "Two HLA-DQ2.5 risk alleles. High celiac predisposition. Discuss testing with your doctor."},
        },
    },
}

# --- Physical appearance predictions (from HIrisPlex-S) ---


def _predict_eye_color(lookup: dict) -> dict:
    herc2 = lookup.get("rs12913832", "GG").upper()
    oca2 = lookup.get("rs1800407", "CC").upper()
    irf4 = lookup.get("rs12203592", "CC").upper()

    if herc2 == "AA":
        color = "Blue"
    elif "A" in herc2:
        if "T" in oca2:
            color = "Hazel"
        elif "T" in irf4:
            color = "Green"
        else:
            color = "Blue/Green"
    else:
        color = "Brown"

    return {"result": color, "gene": "HERC2/OCA2", "rsid": "rs12913832", "genotype": herc2}


def _predict_hair_color(lookup: dict) -> dict:
    mc1r_7 = lookup.get("rs1805007", "").upper()
    mc1r_8 = lookup.get("rs1805008", "").upper()
    slc45 = lookup.get("rs16891982", "").upper()
    kitlg = lookup.get("rs12821256", "").upper()

    if "T" in mc1r_7 or "T" in mc1r_8:
        color = "Red"
    elif "C" in slc45:
        color = "Dark Brown / Black"
    elif "G" in kitlg:
        color = "Blonde"
    else:
        color = "Brown"

    return {"result": color, "gene": "MC1R/SLC45A2", "rsid": "rs1805007", "genotype": mc1r_7}


def _predict_skin_tone(lookup: dict) -> dict:
    slc24a5 = lookup.get("rs1426654", "GG").upper()
    slc45a2 = lookup.get("rs16891982", "").upper()
    a_count = slc24a5.count("A")

    if a_count == 2:
        tone = "Very Light"
    elif a_count == 1:
        tone = "Light / Medium"
    elif "C" in slc45a2:
        tone = "Medium"
    else:
        tone = "Dark"

    return {"result": tone, "gene": "SLC24A5", "rsid": "rs1426654", "genotype": slc24a5}


def analyze_traits(snps: pd.DataFrame) -> dict:
    """Look up nutrition traits + physical appearance predictions."""
    lookup = dict(zip(snps["rsid"].str.lower(), snps["genotype"]))

    results = []

    # Nutrition traits
    for trait_key, config in NUTRITION_SNPS.items():
        rsid = config["rsid"]
        genotype = lookup.get(rsid.lower())

        if genotype is None or genotype == "--":
            results.append({
                "name": config["name"],
                "category": "nutrition",
                "gene": config["gene"],
                "rsid": rsid,
                "genotype": "N/A",
                "status": "not_tested",
                "label": "Not Tested",
                "detail": f"SNP {rsid} was not found in your data file.",
            })
            continue

        interp = config["interpretations"].get(genotype.upper())
        if interp is None:
            # Try reversed genotype
            interp = config["interpretations"].get(genotype.upper()[::-1])

        if interp:
            results.append({
                "name": config["name"],
                "category": "nutrition",
                "gene": config["gene"],
                "rsid": rsid,
                "genotype": genotype,
                **interp,
            })
        else:
            results.append({
                "name": config["name"],
                "category": "nutrition",
                "gene": config["gene"],
                "rsid": rsid,
                "genotype": genotype,
                "status": "unknown",
                "label": "Unrecognized Genotype",
                "detail": f"Genotype {genotype} at {rsid} is not in our interpretation table.",
            })

    # Physical appearance (HIrisPlex-S)
    appearance = {
        "eye_color": _predict_eye_color(lookup),
        "hair_color": _predict_hair_color(lookup),
        "skin_tone": _predict_skin_tone(lookup),
    }

    return {
        "traits": results,
        "appearance": appearance,
        "total_tested": sum(1 for r in results if r["status"] != "not_tested"),
        "disclaimer": "Trait results reflect genetic tendencies based on common variants, not definitive diagnoses.",
    }
