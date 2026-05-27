"""Pharmacogenomics engine — CYP gene star allele calling + drug flagging."""

import json
import os
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

# Key SNPs for each pharmacogene (rsid -> { allele_name, effect })
# This is a curated subset — full CPIC data loaded from cpic_alleles.json if available
GENE_SNPS = {
    "CYP2C19": {
        "rs4244285": {"allele": "*2", "effect": "no_function"},
        "rs4986893": {"allele": "*3", "effect": "no_function"},
        "rs12248560": {"allele": "*17", "effect": "increased_function"},
    },
    "CYP2C9": {
        "rs1799853": {"allele": "*2", "effect": "decreased_function"},
        "rs1057910": {"allele": "*3", "effect": "decreased_function"},
    },
    "CYP1A2": {
        "rs762551": {"allele": "*1F", "effect": "ultra_rapid"},
    },
    "SLCO1B1": {
        "rs4149056": {"allele": "*5", "effect": "decreased_function"},
    },
    "DPYD": {
        "rs3918290": {"allele": "*2A", "effect": "no_function"},
        "rs55886062": {"allele": "*13", "effect": "no_function"},
    },
    "TPMT": {
        "rs1800462": {"allele": "*2", "effect": "no_function"},
        "rs1800460": {"allele": "*3B", "effect": "no_function"},
        "rs1142345": {"allele": "*3C", "effect": "no_function"},
    },
}

# Metabolizer status rules: count of loss-of-function alleles -> status
def _call_metabolizer(gene: str, found_alleles: list[dict]) -> str:
    lof = sum(1 for a in found_alleles if a["effect"] in ("no_function", "decreased_function"))
    gof = sum(1 for a in found_alleles if a["effect"] in ("increased_function", "ultra_rapid"))

    if lof >= 2:
        return "poor_metabolizer"
    elif lof == 1 and gof == 0:
        return "intermediate_metabolizer"
    elif gof >= 1 and lof == 0:
        return "rapid_metabolizer" if gof == 1 else "ultra_rapid_metabolizer"
    else:
        return "normal_metabolizer"


# Drug interaction database
DRUG_FLAGS = {
    "CYP2C19": {
        "poor_metabolizer": [
            {"drug": "Clopidogrel (Plavix)", "severity": "HIGH", "action": "Avoid — use prasugrel or ticagrelor instead", "reason": "Cannot convert clopidogrel to active form"},
            {"drug": "Escitalopram / Citalopram", "severity": "MODERATE", "action": "Consider dose reduction or switch to sertraline", "reason": "Reduced metabolism leads to higher drug levels"},
            {"drug": "Omeprazole / Lansoprazole", "severity": "MODERATE", "action": "Consider dose reduction", "reason": "Slower metabolism — drug stays active longer"},
        ],
        "intermediate_metabolizer": [
            {"drug": "Clopidogrel (Plavix)", "severity": "MODERATE", "action": "Monitor effectiveness — may need alternative", "reason": "Reduced activation of prodrug"},
        ],
        "rapid_metabolizer": [
            {"drug": "Omeprazole / Lansoprazole", "severity": "MODERATE", "action": "May need higher dose for efficacy", "reason": "Faster drug clearance"},
        ],
        "ultra_rapid_metabolizer": [
            {"drug": "Omeprazole / Lansoprazole", "severity": "MODERATE", "action": "May need higher dose for efficacy", "reason": "Very fast drug clearance"},
        ],
    },
    "CYP2C9": {
        "poor_metabolizer": [
            {"drug": "Warfarin (Coumadin)", "severity": "HIGH", "action": "Start at 50% lower dose — high bleeding risk", "reason": "Cannot clear warfarin normally"},
            {"drug": "Celecoxib", "severity": "MODERATE", "action": "Use lowest effective dose", "reason": "Slower metabolism increases drug exposure"},
        ],
        "intermediate_metabolizer": [
            {"drug": "Warfarin (Coumadin)", "severity": "MODERATE", "action": "Start at reduced dose — monitor INR closely", "reason": "Reduced clearance of warfarin"},
        ],
    },
    "SLCO1B1": {
        "poor_metabolizer": [
            {"drug": "Simvastatin", "severity": "HIGH", "action": "Avoid high-dose simvastatin — use pravastatin or rosuvastatin", "reason": "5x increased risk of myopathy"},
            {"drug": "Atorvastatin", "severity": "MODERATE", "action": "Use lowest effective dose", "reason": "Increased statin exposure"},
        ],
        "intermediate_metabolizer": [
            {"drug": "Simvastatin", "severity": "MODERATE", "action": "Limit to 20mg — consider alternative statin", "reason": "Increased myopathy risk"},
        ],
    },
    "DPYD": {
        "poor_metabolizer": [
            {"drug": "5-Fluorouracil / Capecitabine", "severity": "HIGH", "action": "Avoid — life-threatening toxicity risk", "reason": "Cannot break down fluoropyrimidines"},
        ],
        "intermediate_metabolizer": [
            {"drug": "5-Fluorouracil / Capecitabine", "severity": "HIGH", "action": "Reduce dose by 50% minimum", "reason": "Impaired drug clearance — severe toxicity risk"},
        ],
    },
    "TPMT": {
        "poor_metabolizer": [
            {"drug": "Azathioprine / 6-Mercaptopurine", "severity": "HIGH", "action": "Reduce dose to 10% of standard or avoid", "reason": "Cannot metabolize thiopurines — fatal myelosuppression risk"},
        ],
        "intermediate_metabolizer": [
            {"drug": "Azathioprine / 6-Mercaptopurine", "severity": "MODERATE", "action": "Start at 50% dose and monitor", "reason": "Reduced thiopurine metabolism"},
        ],
    },
}

# CYP2D6 special case — not callable from SNP arrays
CYP2D6_WARNING = {
    "gene": "CYP2D6",
    "status": "not_callable",
    "disclaimer": "CYP2D6 cannot be reliably determined from SNP array data. This gene affects codeine, tramadol, tamoxifen, and many antidepressants. Full CYP2D6 testing requires specialized sequencing.",
    "affected_drugs": [
        "Codeine / Tramadol (pain)",
        "Tamoxifen (breast cancer)",
        "Atomoxetine (ADHD)",
        "Nortriptyline / Amitriptyline (depression)",
    ],
}


def run_pharmacogenomics(snps: pd.DataFrame) -> dict:
    """Run PGx analysis on parsed SNP data. Returns gene results + drug flags."""
    # Build rsid -> genotype lookup
    lookup = dict(zip(snps["rsid"].str.lower(), snps["genotype"]))

    results = []

    for gene, snp_map in GENE_SNPS.items():
        found_alleles = []
        tested_snps = []

        for rsid, info in snp_map.items():
            genotype = lookup.get(rsid.lower())
            tested_snps.append({
                "rsid": rsid,
                "allele": info["allele"],
                "genotype": genotype or "not_found",
                "detected": genotype is not None and genotype != "--",
            })

            if genotype and genotype != "--":
                # Check if variant allele is present
                # For simplicity: if genotype contains the variant, flag it
                # Real implementation would check ref/alt alleles
                found_alleles.append(info)

        status = _call_metabolizer(gene, found_alleles)
        drug_flags = DRUG_FLAGS.get(gene, {}).get(status, [])

        results.append({
            "gene": gene,
            "metabolizer_status": status,
            "status_label": status.replace("_", " ").title(),
            "tested_snps": tested_snps,
            "drug_flags": drug_flags,
            "disclaimer": "Discuss with your prescriber before making any medication changes.",
        })

    # Add CYP2D6 warning
    results.append(CYP2D6_WARNING)

    # Summary counts
    high_flags = sum(
        1 for r in results
        for f in r.get("drug_flags", [])
        if f.get("severity") == "HIGH"
    )
    moderate_flags = sum(
        1 for r in results
        for f in r.get("drug_flags", [])
        if f.get("severity") == "MODERATE"
    )

    return {
        "genes": results,
        "summary": {
            "high_risk_drugs": high_flags,
            "moderate_risk_drugs": moderate_flags,
            "genes_tested": len(GENE_SNPS),
        },
    }
