"""Nutrition and trait SNP analysis — driven by HIrisPlex-S JSON dataset."""

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

# Lazy-loaded HIrisPlex data
_hirisplex = None


def _load_hirisplex():
    global _hirisplex
    if _hirisplex is not None:
        return
    path = DATA_DIR / "hirisplex" / "hirisplex_s_snps.json"
    if path.exists():
        _hirisplex = json.loads(path.read_text())
    else:
        _hirisplex = {}


# Detailed interpretation tables (kept inline — HIrisPlex JSON has short labels)
TRAIT_DETAILS = {
    "caffeine": {
        "name": "Caffeine Sensitivity",
        "category": "nutrition",
        "status_map": {
            "Fast metabolizer": {"status": "fast", "label": "Fast Caffeine Metabolizer", "detail": "You break down caffeine quickly. Moderate coffee consumption may be associated with health benefits for your genotype."},
            "Slow metabolizer": {"status": "slow", "label": "Slow Caffeine Metabolizer", "detail": "You metabolize caffeine more slowly. High caffeine intake may increase cardiovascular risk for your genotype."},
        },
    },
    "lactose": {
        "name": "Lactose Intolerance",
        "category": "nutrition",
        "status_map": {
            "Tolerant": {"status": "tolerant", "label": "Likely Lactose Tolerant", "detail": "You carry the lactase persistence variant. You likely produce lactase into adulthood."},
            "Intolerant": {"status": "intolerant", "label": "Likely Lactose Intolerant", "detail": "You likely produce less lactase enzyme after childhood. Dairy may cause digestive discomfort."},
        },
    },
    "alcohol_flush": {
        "name": "Alcohol Flush Reaction",
        "category": "nutrition",
        "status_map": {
            "Normal": {"status": "normal", "label": "No Alcohol Flush", "detail": "You have normal ALDH2 function. No genetic predisposition to alcohol flush reaction."},
            "Mild flush": {"status": "mild_flush", "label": "Mild Alcohol Flush", "detail": "You carry one copy of the ALDH2 variant. You may experience mild flushing with alcohol."},
            "Flush — avoid alcohol": {"status": "flush", "label": "Alcohol Flush — Avoid Alcohol", "detail": "You have two copies of the ALDH2 deficiency variant. You cannot efficiently break down acetaldehyde, causing facial flushing, nausea, and increased cancer risk with alcohol."},
        },
    },
    "vitamin_d": {
        "name": "Vitamin D Absorption",
        "category": "nutrition",
        "status_map": {
            "Normal": {"status": "normal", "label": "Normal Vitamin D Absorption", "detail": "You have the typical variant for vitamin D binding protein. Normal absorption expected."},
            "Slightly reduced": {"status": "slightly_reduced", "label": "Slightly Reduced Vitamin D", "detail": "You carry one copy of the variant associated with lower vitamin D. Monitor your levels."},
            "Reduced absorption": {"status": "reduced", "label": "Reduced Vitamin D Absorption", "detail": "You may have lower circulating vitamin D levels. Consider supplementation and regular testing."},
        },
    },
    "folate": {
        "name": "Folate Processing (MTHFR)",
        "category": "nutrition",
        "status_map": {
            "Normal": {"status": "normal", "label": "Normal Folate Processing", "detail": "You have the typical MTHFR variant. Normal folate metabolism expected."},
            "Mildly reduced": {"status": "slightly_reduced", "label": "Mildly Reduced Folate Processing", "detail": "You carry one copy of the MTHFR C677T variant. Adequate dietary folate usually sufficient."},
            "Reduced — consider methylfolate": {"status": "reduced", "label": "Reduced Folate Processing", "detail": "You have the MTHFR C677T homozygous variant. You may benefit from methylfolate (5-MTHF) instead of regular folic acid."},
        },
    },
    "celiac": {
        "name": "Celiac Disease Risk",
        "category": "nutrition",
        "status_map": {
            "Lower risk": {"status": "low", "label": "Lower Celiac Risk", "detail": "You do not carry the tested HLA risk variant. Lower genetic predisposition, though other variants exist."},
            "Moderate risk": {"status": "moderate", "label": "Moderate Celiac Risk", "detail": "You carry one HLA risk variant. Moderate genetic predisposition to celiac disease."},
            "Elevated risk": {"status": "elevated", "label": "Elevated Celiac Risk", "detail": "You carry HLA variants associated with increased celiac disease susceptibility. If you have symptoms, discuss testing with your doctor."},
        },
    },
}


def analyze_traits(snps: pd.DataFrame) -> dict:
    """Look up nutrition and trait SNPs using HIrisPlex-S dataset."""
    _load_hirisplex()
    lookup = dict(zip(snps["rsid"].str.lower(), snps["genotype"]))

    nutrition_traits = _hirisplex.get("nutrition_traits", {})
    results = []

    for trait_key, detail in TRAIT_DETAILS.items():
        trait_def = nutrition_traits.get(trait_key)
        if not trait_def:
            continue

        rsid = trait_def["rsid"]
        gene = trait_def["gene"]
        interpretations = trait_def["interpretations"]

        genotype = lookup.get(rsid.lower())

        if genotype is None or genotype == "--":
            results.append({
                "name": detail["name"],
                "category": detail["category"],
                "gene": gene,
                "rsid": rsid,
                "genotype": "N/A",
                "status": "not_tested",
                "label": "Not Tested",
                "detail": f"SNP {rsid} was not found in your data file.",
            })
            continue

        # Look up interpretation from HIrisPlex JSON
        short_label = interpretations.get(genotype.upper())
        if short_label is None:
            # Try reversed genotype (e.g. GA vs AG)
            reversed_gt = genotype.upper()[::-1]
            short_label = interpretations.get(reversed_gt)

        if short_label and short_label in detail["status_map"]:
            interp = detail["status_map"][short_label]
            results.append({
                "name": detail["name"],
                "category": detail["category"],
                "gene": gene,
                "rsid": rsid,
                "genotype": genotype,
                **interp,
            })
        else:
            results.append({
                "name": detail["name"],
                "category": detail["category"],
                "gene": gene,
                "rsid": rsid,
                "genotype": genotype,
                "status": "unknown",
                "label": "Unrecognized Genotype",
                "detail": f"Genotype {genotype} at {rsid} is not in our interpretation table.",
            })

    return {
        "traits": results,
        "total_tested": sum(1 for r in results if r["status"] != "not_tested"),
        "data_source": "HIrisPlex-S (Walsh et al. 2017)",
    }
