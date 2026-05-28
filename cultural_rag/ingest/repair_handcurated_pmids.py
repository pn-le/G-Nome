"""
Repair hand-curated PMIDs by searching PubMed for the actual correct papers.

For each doc with a wrong PMID (detected by verify_handcurated_pmids),
this script searches PubMed with targeted keywords, finds the best matching
real paper, and updates the JSON in-place.

Usage:
    cd backend
    python -m cultural_rag.ingest.repair_handcurated_pmids
"""

import json
import time
import os
import re
import xml.etree.ElementTree as ET
import requests
from pathlib import Path

from cultural_rag.config import DATA_DIR

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
NCBI_API_KEY = os.environ.get("NCBI_API_KEY", "")

# Targeted search queries for each doc that needs a real PMID.
# Key: doc id. Value: PubMed search string (no pt filter applied here — we add it below).
REPAIR_TARGETS: dict[str, str] = {
    "east_asian_drug_grapefruit_cyp3a4":     "grapefruit pomelo furanocoumarins CYP3A4 statin simvastatin interaction",
    "east_asian_caffeine_cyp1a2":            "CYP1A2 caffeine metabolism genetic polymorphism slow fast metabolizer",
    "east_asian_vitamin_d_absorption":       "vitamin D deficiency East Asian population dietary intake",
    "south_asian_t2d_metabolic_syndrome":    "South Asian type 2 diabetes metabolic syndrome thin-fat phenotype visceral adiposity",
    "south_asian_drug_turmeric_anticoagulants": "curcumin turmeric antiplatelet anticoagulant warfarin bleeding interaction",
    "african_t2d_cassava_glycemic":          "cassava glycemic index plantain diabetes Sub-Saharan Africa diet",
    "middle_eastern_caffeine_coffee_culture":"Arabic coffee caffeine CYP1A2 metabolism Middle Eastern population",
    "african_vitamin_d_melanin":             "vitamin D deficiency melanin skin pigmentation African descent synthesis",
    "southeast_asian_drug_coconut_interactions": "coconut oil lauric acid LDL HDL cholesterol cardiovascular Southeast Asia",
    "vietnamese_drug_starfruit_renal":       "star fruit carambola caramboxin nephrotoxicity renal failure toxicity",
    "vietnamese_t2d_pho_glycemic":           "rice noodles glycemic index Vietnamese Southeast Asian diet diabetes",
    "vietnamese_cad_sodium":                 "sodium intake fish sauce Southeast Asian Vietnamese diet hypertension cardiovascular",
    "korean_drug_ginseng_anticoagulant":     "Panax ginseng ginsenoside antiplatelet anticoagulant warfarin herb drug interaction",
    "korean_t2d_kimchi_glucose":             "kimchi fermented vegetable type 2 diabetes blood glucose insulin sensitivity probiotic",
    "korean_cad_sodium_balance":             "Korean diet sodium intake kimchi cardiovascular disease mortality",
    "japanese_drug_natto_warfarin":          "natto vitamin K2 menaquinone warfarin INR anticoagulant interaction",
    "japanese_t2d_washoku_glycemic":         "Japanese traditional diet washoku type 2 diabetes glycemic fish",
    "japanese_cad_omega3_longevity":         "Japanese diet omega-3 fish cardiovascular mortality longevity DHA EPA",
    "indian_drug_licorice_antihypertensive": "licorice glycyrrhizin pseudoaldosteronism hypertension blood pressure antihypertensive",
    "indian_t2d_subcontinental_diet":        "Indian diet type 2 diabetes lentils dal roti glycemic index South Asian",
    "indian_vitamin_d_vegetarian":           "Indian vegetarian diet vitamin D deficiency supplementation urban",
    "italian_drug_licorice_amaro":           "licorice glycyrrhizin amaro herbal liqueur hypertension pseudoaldosteronism",
    "italian_celiac_pasta_alternatives":     "Italian Mediterranean diet celiac disease gluten-free pasta wheat alternative",
    "german_drug_stjohnswort_cyp":           "St John wort Hypericum perforatum CYP3A4 induction drug interaction pharmacokinetics",
    "german_cad_processed_meat_rye":         "rye bread whole grain cardiovascular LDL cholesterol processed meat cancer",
    "german_celiac_bread_alternatives":      "celiac disease European diet gluten-free rye wheat bread alternative",
    "brazilian_drug_guarana_caffeine":       "guarana Paullinia cupana caffeine pharmacology pharmacokinetics",
    "brazilian_t2d_feijao_rice":             "black beans rice glycemic index type 2 diabetes Brazil legumes",
    "brazilian_cad_acai_palm_oil":           "acai Euterpe oleracea antioxidant lipid cardiovascular LDL",
    "mexican_drug_nopales_hypoglycemic":     "nopales nopal Opuntia prickly pear diabetes blood glucose hypoglycemic",
    "mexican_t2d_traditional_vs_westernized":"Mexican traditional diet diabetes corn tortilla beans glycemic westernized",
}

# These already have confirmed correct PMIDs — skip them
CONFIRMED_CORRECT: set[str] = {
    "east_asian_t2d_rice_glycemic",       # PMID:22422870 ✓
    "european_celiac_gluten_alternatives", # PMID:29551598 ✓
    "italian_cad_mediterranean_evidence",  # PMID:23432189 ✓ PREDIMED
    "mexican_cad_avocado_legumes",         # PMID:25567051 ✓
    "vietnamese_t2d_pho_glycemic",         # reuses 22422870 ✓
    "italian_celiac_pasta_alternatives",   # reuses 29551598 — partial match, acceptable
    "middle_eastern_celiac_wheat_alternatives",  # PMID:28244676 "What is gluten?" — acceptable
    "german_celiac_bread_alternatives",    # reuses 28244676 — acceptable
}


def _esearch(query: str, retmax: int = 5) -> list[str]:
    full_query = f"({query}) AND (systematic review[pt] OR randomized controlled trial[pt] OR meta-analysis[pt])"
    params = {"db": "pubmed", "term": full_query, "retmax": retmax, "retmode": "json"}
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
    resp = requests.get(ESEARCH_URL, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("esearchresult", {}).get("idlist", [])


def _efetch_titles(pmids: list[str]) -> list[dict]:
    if not pmids:
        return []
    params = {"db": "pubmed", "id": ",".join(pmids), "rettype": "abstract", "retmode": "xml"}
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY
    resp = requests.get(EFETCH_URL, params=params, timeout=20)
    resp.raise_for_status()

    results = []
    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        return []

    for article in root.findall(".//PubmedArticle"):
        pmid_e = article.find(".//PMID")
        title_e = article.find(".//ArticleTitle")
        year_e  = article.find(".//PubDate/Year")
        abs_e   = article.find(".//AbstractText")
        if pmid_e is not None and title_e is not None:
            results.append({
                "pmid":  pmid_e.text,
                "title": title_e.text or "",
                "year":  year_e.text if year_e is not None else "?",
                "abstract": abs_e.text if abs_e is not None else "",
            })
    return results


def repair(dry_run: bool = False) -> None:
    hc_dir = DATA_DIR / "handcurated"
    hc_file = hc_dir / "cultural_drug_food_nutrition.json"

    docs: list[dict] = json.load(open(hc_file, encoding="utf-8"))
    doc_by_id = {d["id"]: d for d in docs}

    replacements: dict[str, str] = {}  # doc_id -> new PMID

    total = len(REPAIR_TARGETS)
    for i, (doc_id, query) in enumerate(REPAIR_TARGETS.items()):
        if doc_id in CONFIRMED_CORRECT:
            print(f"[{i+1}/{total}] {doc_id} — SKIPPED (confirmed correct)")
            continue

        doc = doc_by_id.get(doc_id)
        if not doc:
            print(f"[{i+1}/{total}] {doc_id} — NOT FOUND IN JSON")
            continue

        current_pmid = doc.get("evidence_source", "").replace("PMID:", "").strip()
        print(f"\n[{i+1}/{total}] {doc_id}")
        print(f"  Current PMID: {current_pmid}")
        print(f"  Search: {query[:70]}...")

        try:
            pmids = _esearch(query)
            time.sleep(0.5)

            if not pmids:
                # Broaden — drop the RCT/systematic filter
                params = {"db": "pubmed", "term": query, "retmax": 5, "retmode": "json"}
                if NCBI_API_KEY:
                    params["api_key"] = NCBI_API_KEY
                r = requests.get(ESEARCH_URL, params=params, timeout=15)
                pmids = r.json().get("esearchresult", {}).get("idlist", [])
                time.sleep(0.5)

            if not pmids:
                print(f"  NO RESULTS — keeping current PMID")
                continue

            papers = _efetch_titles(pmids)
            time.sleep(0.5)

            if not papers:
                print(f"  FETCH FAILED — keeping current PMID")
                continue

            best = papers[0]
            print(f"  BEST MATCH: PMID:{best['pmid']} ({best['year']})")
            print(f"  Title: {best['title'][:85]}")

            replacements[doc_id] = best["pmid"]

        except Exception as e:
            print(f"  ERROR: {e} — keeping current PMID")

        time.sleep(0.4)

    # Apply replacements
    print(f"\n{'='*60}")
    print(f"Replacements found: {len(replacements)}")

    if not replacements:
        print("Nothing to update.")
        return

    if dry_run:
        print("DRY RUN — no files modified.")
        for doc_id, new_pmid in replacements.items():
            old = doc_by_id[doc_id]["evidence_source"]
            print(f"  {doc_id}: {old} -> PMID:{new_pmid}")
        return

    for doc in docs:
        if doc["id"] in replacements:
            old = doc["evidence_source"]
            doc["evidence_source"] = f"PMID:{replacements[doc['id']]}"
            print(f"  Updated {doc['id']}: {old} -> {doc['evidence_source']}")

    with open(hc_file, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\nSaved {len(docs)} docs to {hc_file}")


if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv
    repair(dry_run=dry)
