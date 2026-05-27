"""Nutrition and trait SNP analysis — hardcoded lookups, no external API."""

import pandas as pd

TRAIT_SNPS = [
    {
        "name": "Lactose Intolerance",
        "category": "nutrition",
        "gene": "MCM6",
        "rsid": "rs4988235",
        "interpretations": {
            "CC": {"status": "intolerant", "label": "Likely Lactose Intolerant", "detail": "You likely produce less lactase enzyme after childhood. Dairy may cause digestive discomfort."},
            "CT": {"status": "tolerant", "label": "Likely Lactose Tolerant", "detail": "You carry one copy of the lactase persistence variant. Most people with this genotype digest dairy normally."},
            "TC": {"status": "tolerant", "label": "Likely Lactose Tolerant", "detail": "You carry one copy of the lactase persistence variant. Most people with this genotype digest dairy normally."},
            "TT": {"status": "tolerant", "label": "Lactose Tolerant", "detail": "You carry the lactase persistence variant. You likely produce lactase into adulthood."},
        },
    },
    {
        "name": "Alcohol Flush Reaction",
        "category": "nutrition",
        "gene": "ALDH2",
        "rsid": "rs671",
        "interpretations": {
            "AA": {"status": "flush", "label": "Alcohol Flush — Avoid Alcohol", "detail": "You have two copies of the ALDH2 deficiency variant. You cannot efficiently break down acetaldehyde, causing facial flushing, nausea, and increased cancer risk with alcohol."},
            "AG": {"status": "mild_flush", "label": "Mild Alcohol Flush", "detail": "You carry one copy of the ALDH2 variant. You may experience mild flushing with alcohol and have moderately reduced acetaldehyde clearance."},
            "GA": {"status": "mild_flush", "label": "Mild Alcohol Flush", "detail": "You carry one copy of the ALDH2 variant. You may experience mild flushing with alcohol and have moderately reduced acetaldehyde clearance."},
            "GG": {"status": "normal", "label": "No Alcohol Flush", "detail": "You have normal ALDH2 function. No genetic predisposition to alcohol flush reaction."},
        },
    },
    {
        "name": "Caffeine Sensitivity",
        "category": "nutrition",
        "gene": "CYP1A2",
        "rsid": "rs762551",
        "interpretations": {
            "AA": {"status": "fast", "label": "Fast Caffeine Metabolizer", "detail": "You break down caffeine quickly. Moderate coffee consumption may be associated with health benefits for your genotype."},
            "AC": {"status": "slow", "label": "Slow Caffeine Metabolizer", "detail": "You metabolize caffeine more slowly. High caffeine intake may increase cardiovascular risk for your genotype."},
            "CA": {"status": "slow", "label": "Slow Caffeine Metabolizer", "detail": "You metabolize caffeine more slowly. High caffeine intake may increase cardiovascular risk for your genotype."},
            "CC": {"status": "slow", "label": "Slow Caffeine Metabolizer", "detail": "You metabolize caffeine slowly. Consider limiting intake to 1-2 cups of coffee per day."},
        },
    },
    {
        "name": "Vitamin D Absorption",
        "category": "nutrition",
        "gene": "GC",
        "rsid": "rs2282679",
        "interpretations": {
            "TT": {"status": "reduced", "label": "Reduced Vitamin D Absorption", "detail": "You may have lower circulating vitamin D levels. Consider supplementation and regular testing, especially if you have limited sun exposure."},
            "GT": {"status": "slightly_reduced", "label": "Slightly Reduced Vitamin D", "detail": "You carry one copy of the variant associated with lower vitamin D. Monitor your levels."},
            "TG": {"status": "slightly_reduced", "label": "Slightly Reduced Vitamin D", "detail": "You carry one copy of the variant associated with lower vitamin D. Monitor your levels."},
            "GG": {"status": "normal", "label": "Normal Vitamin D Absorption", "detail": "You have the typical variant for vitamin D binding protein. Normal absorption expected."},
        },
    },
    {
        "name": "Folate Processing (MTHFR)",
        "category": "nutrition",
        "gene": "MTHFR",
        "rsid": "rs1801133",
        "interpretations": {
            "TT": {"status": "reduced", "label": "Reduced Folate Processing", "detail": "You have the MTHFR C677T homozygous variant. You may benefit from methylfolate (5-MTHF) supplementation instead of regular folic acid."},
            "CT": {"status": "slightly_reduced", "label": "Mildly Reduced Folate Processing", "detail": "You carry one copy of the MTHFR C677T variant. Folate processing is mildly reduced. Adequate dietary folate usually sufficient."},
            "TC": {"status": "slightly_reduced", "label": "Mildly Reduced Folate Processing", "detail": "You carry one copy of the MTHFR C677T variant. Folate processing is mildly reduced. Adequate dietary folate usually sufficient."},
            "CC": {"status": "normal", "label": "Normal Folate Processing", "detail": "You have the typical MTHFR variant. Normal folate metabolism expected."},
        },
    },
    {
        "name": "Celiac Disease Risk",
        "category": "nutrition",
        "gene": "HLA-DQ",
        "rsid": "rs2395182",
        "interpretations": {
            "GG": {"status": "elevated", "label": "Elevated Celiac Risk", "detail": "You carry HLA variants associated with increased celiac disease susceptibility. This does not mean you have celiac — but if you have symptoms, discuss testing with your doctor."},
            "GT": {"status": "moderate", "label": "Moderate Celiac Risk", "detail": "You carry one HLA risk variant. Moderate genetic predisposition to celiac disease."},
            "TG": {"status": "moderate", "label": "Moderate Celiac Risk", "detail": "You carry one HLA risk variant. Moderate genetic predisposition to celiac disease."},
            "TT": {"status": "low", "label": "Lower Celiac Risk", "detail": "You do not carry the tested HLA risk variant. Lower genetic predisposition, though other variants exist."},
        },
    },
]


def analyze_traits(snps: pd.DataFrame) -> dict:
    """Look up nutrition and trait SNPs in parsed data."""
    lookup = dict(zip(snps["rsid"].str.lower(), snps["genotype"]))

    results = []

    for trait in TRAIT_SNPS:
        rsid = trait["rsid"]
        genotype = lookup.get(rsid.lower())

        if genotype is None or genotype == "--":
            results.append({
                "name": trait["name"],
                "category": trait["category"],
                "gene": trait["gene"],
                "rsid": rsid,
                "genotype": "N/A",
                "status": "not_tested",
                "label": "Not Tested",
                "detail": f"SNP {rsid} was not found in your data file.",
            })
            continue

        interp = trait["interpretations"].get(genotype.upper())
        if interp is None:
            # Unknown genotype — report what we see
            results.append({
                "name": trait["name"],
                "category": trait["category"],
                "gene": trait["gene"],
                "rsid": rsid,
                "genotype": genotype,
                "status": "unknown",
                "label": "Unrecognized Genotype",
                "detail": f"Genotype {genotype} at {rsid} is not in our interpretation table.",
            })
            continue

        results.append({
            "name": trait["name"],
            "category": trait["category"],
            "gene": trait["gene"],
            "rsid": rsid,
            "genotype": genotype,
            **interp,
        })

    return {
        "traits": results,
        "total_tested": sum(1 for r in results if r["status"] != "not_tested"),
    }
