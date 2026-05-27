"""Carrier status detection — ClinVar pathogenic variant lookup."""

import pandas as pd

# Curated carrier screening panel
# Each entry: rsid, gene, condition, pathogenic_genotypes (list of genotypes that indicate carrier)
CARRIER_PANEL = [
    {
        "rsid": "rs75961395",
        "gene": "CFTR",
        "condition": "Cystic Fibrosis",
        "pathogenic_genotypes": ["AG", "GA"],  # heterozygous = carrier
        "affected_genotypes": ["AA"],  # homozygous pathogenic
        "notes": "Tests for F508del (most common CF mutation). Does not cover all ~2,000 known CFTR variants.",
    },
    {
        "rsid": "rs334",
        "gene": "HBB",
        "condition": "Sickle Cell Disease",
        "pathogenic_genotypes": ["AT", "TA"],
        "affected_genotypes": ["TT"],
        "notes": "Tests for HbS variant (rs334 A>T). Heterozygous = sickle cell trait (carrier).",
    },
    {
        "rsid": "rs76723693",
        "gene": "HEXA",
        "condition": "Tay-Sachs Disease",
        "pathogenic_genotypes": ["CT", "TC"],
        "affected_genotypes": ["TT"],
        "notes": "Tests for one common variant. Ashkenazi Jewish, French Canadian, and Cajun populations have higher carrier rates.",
    },
    {
        "rsid": "rs11549407",
        "gene": "HBB",
        "condition": "Beta-Thalassemia",
        "pathogenic_genotypes": ["AG", "GA"],
        "affected_genotypes": ["AA"],
        "notes": "Tests for one common beta-globin variant. Full screening requires sequencing.",
    },
    {
        "rsid": "rs76763715",
        "gene": "GBA",
        "condition": "Gaucher Disease",
        "pathogenic_genotypes": ["AG", "GA"],
        "affected_genotypes": ["AA"],
        "notes": "Tests for N370S variant. Carrier rate ~1 in 15 in Ashkenazi Jewish populations.",
    },
]


def check_carrier_status(snps: pd.DataFrame) -> dict:
    """Check carrier status for curated panel of conditions."""
    lookup = dict(zip(snps["rsid"].str.lower(), snps["genotype"]))

    results = []

    for panel_entry in CARRIER_PANEL:
        rsid = panel_entry["rsid"]
        genotype = lookup.get(rsid.lower())

        if genotype is None or genotype == "--":
            status = "not_tested"
            status_label = "Variant Not Tested"
            detail = f"SNP {rsid} was not present in your data file."
        elif genotype.upper() in [g.upper() for g in panel_entry["affected_genotypes"]]:
            status = "two_copies"
            status_label = "Two Copies Detected"
            detail = f"Homozygous pathogenic variant detected at {rsid}. This suggests affected status."
        elif genotype.upper() in [g.upper() for g in panel_entry["pathogenic_genotypes"]]:
            status = "carrier"
            status_label = "Carrier (One Copy)"
            detail = f"Heterozygous variant detected at {rsid}. You carry one copy of this variant."
        else:
            status = "not_detected"
            status_label = "Variant Not Detected"
            detail = f"The specific variant we tested for ({rsid}) was not found in your genotype."

        results.append({
            "gene": panel_entry["gene"],
            "condition": panel_entry["condition"],
            "rsid": rsid,
            "genotype": genotype or "N/A",
            "status": status,
            "status_label": status_label,
            "detail": detail,
            "notes": panel_entry["notes"],
            "disclaimer": "We did not detect the specific variants we tested for. This does not mean you are not a carrier. This panel tests a limited set of variants — comprehensive screening requires clinical-grade sequencing.",
        })

    carriers_found = sum(1 for r in results if r["status"] in ("carrier", "two_copies"))

    return {
        "results": results,
        "carriers_found": carriers_found,
        "conditions_tested": len(CARRIER_PANEL),
        "disclaimer": "Carrier screening tested a limited panel of variants. A negative result does not rule out carrier status for untested variants.",
    }
