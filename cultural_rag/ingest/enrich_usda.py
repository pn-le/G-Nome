"""
Enrich USDA corpus with condition-specific clinical narrative documents.

Reads usda_corpus_raw.json (flat nutrient dumps, all tagged general_nutrition)
and generates condition-tagged variant documents based on nutrient thresholds.

Rule-based only — no LLM calls, no API credits, runs in seconds.

Output: usda_corpus_enriched.json — same format as corpus_verified.json,
ready to merge and load into Supabase.

Usage:
    cd backend
    python -m cultural_rag.ingest.enrich_usda
"""

import json
import re
from pathlib import Path

from cultural_rag.config import DATA_DIR, CULTURE_HIERARCHY


# ---------------------------------------------------------------------------
# Known glycemic index for starchy staples — USDA doesn't include GI.
# Maps lowercase food description keywords → (GI, label, concern/protective).
# Used to override the misleading "low sugar = suitable for T2D" rule.
# ---------------------------------------------------------------------------
_KNOWN_GI: dict[str, tuple[int, str, str]] = {
    "white rice":        (79, "high glycemic index (~79)",   "concern"),
    "jasmine rice":      (89, "very high glycemic index (~89)", "concern"),
    "sushi rice":        (72, "high glycemic index (~72)",   "concern"),
    "basmati rice":      (52, "moderate-low glycemic index (~52)", "protective"),
    "brown rice":        (55, "moderate glycemic index (~55)", "protective"),
    "rice noodle":       (65, "moderate-high glycemic index (~65)", "concern"),
    "rice flour":        (72, "high glycemic index (~72)",   "concern"),
    "cassava":           (94, "very high glycemic index (~94)", "concern"),
    "white bread":       (75, "high glycemic index (~75)",   "concern"),
    "pretzel":           (83, "high glycemic index (~83)",   "concern"),
    "dates":             (62, "moderate-high glycemic index (~62)", "concern"),
    "mochi":             (85, "high glycemic index (~85)",   "concern"),
    "rice cake":         (85, "high glycemic index (~85)",   "concern"),
    "udon":              (62, "moderate-high glycemic index (~62)", "concern"),
    "potato":            (78, "high glycemic index (~78)",   "concern"),
    "cornflake":         (81, "high glycemic index (~81)",   "concern"),
    "sweet potato":      (48, "moderate glycemic index (~48)", "protective"),
    "soba":              (54, "moderate glycemic index (~54)", "protective"),
    "pumpernickel":      (41, "low glycemic index (~41)",    "protective"),
    "rye bread":         (50, "low glycemic index (~50)",    "protective"),
    "rolled oat":        (55, "moderate glycemic index (~55)", "protective"),
    "barley":            (28, "low glycemic index (~28)",    "protective"),
    "lentil":            (26, "low glycemic index (~26)",    "protective"),
    "chickpea":          (28, "low glycemic index (~28)",    "protective"),
    "black bean":        (30, "low glycemic index (~30)",    "protective"),
    "pinto bean":        (33, "low glycemic index (~33)",    "protective"),
    "shirataki":         (2,  "near-zero glycemic index (~2)", "protective"),
    "konjac":            (2,  "near-zero glycemic index (~2)", "protective"),
    "bulgur":            (46, "low glycemic index (~46)",    "protective"),
    "sourdough":         (48, "moderate glycemic index (~48)", "protective"),
    "whole wheat pasta": (42, "low glycemic index (~42)",    "protective"),
    "pasta":             (49, "moderate glycemic index (~49)", "protective"),
}


def _lookup_gi(food_desc: str) -> tuple[int, str, str] | None:
    """Return (GI, label, direction) if the food description matches a known GI entry."""
    desc_lower = food_desc.lower()
    for keyword, gi_info in _KNOWN_GI.items():
        if keyword in desc_lower:
            return gi_info
    return None


# ---------------------------------------------------------------------------
# Nutrient extraction from content string
# ---------------------------------------------------------------------------
_NUTRIENT_PATTERNS: dict[str, str] = {
    "fiber":         r"Fiber, total dietary:\s*([\d.]+)",
    "sugar":         r"Total Sugars:\s*([\d.]+)",
    "saturated_fat": r"Fatty acids, total saturated:\s*([\d.]+)",
    "sodium":        r"Sodium, Na:\s*([\d.]+)",
    "potassium":     r"Potassium, K:\s*([\d.]+)",
    "calcium":       r"Calcium, Ca:\s*([\d.]+)",
    "magnesium":     r"Magnesium, Mg:\s*([\d.]+)",
    "omega3_ala":    r"PUFA 18:3[^:]*:\s*([\d.]+)",
    "omega3_epa":    r"PUFA 20:5[^:]*:\s*([\d.]+)",
    "omega3_dha":    r"PUFA 22:6[^:]*:\s*([\d.]+)",
    "vitamin_k":     r"Vitamin K \(phylloquinone\):\s*([\d.]+)",
    "vitamin_d":     r"Vitamin D[^:]*:\s*([\d.]+)",
    "vitamin_c":     r"Vitamin C, total ascorbic acid:\s*([\d.]+)",
    "folate":        r"Folate, total:\s*([\d.]+)",
    "caffeine":      r"Caffeine:\s*([\d.]+)",
    "protein":       r"Protein:\s*([\d.]+)",
    "carbs":         r"Carbohydrate, by difference:\s*([\d.]+)",
    "energy_kcal":   r"Energy:\s*([\d.]+)KCAL",
    "fat_total":     r"Total lipid \(fat\):\s*([\d.]+)",
    "iron":          r"Iron, Fe:\s*([\d.]+)",
    "zinc":          r"Zinc, Zn:\s*([\d.]+)",
}


def _extract(content: str, key: str) -> float:
    m = re.search(_NUTRIENT_PATTERNS[key], content, re.IGNORECASE)
    return float(m.group(1)) if m else 0.0


def _extract_all(content: str) -> dict[str, float]:
    return {k: _extract(content, k) for k in _NUTRIENT_PATTERNS}


def _food_desc(content: str) -> str:
    """Extract the USDA food description before the first parenthesis nutrient block."""
    m = re.match(r"^(.+?)\s*\(USDA", content)
    return m.group(1).strip() if m else "This food"


def _fdc_id(doc: dict) -> str:
    return doc.get("evidence_source", "USDA fdcId:unknown")


def _culture_str(culture: str) -> str:
    parent = CULTURE_HIERARCHY.get(culture, culture)
    return f"{culture} ({parent})" if parent != culture else culture


# ---------------------------------------------------------------------------
# Condition-specific document generators
# ---------------------------------------------------------------------------

def _t2d_doc(doc: dict, n: dict) -> dict | None:
    """
    Generate a T2D-relevant document. GI lookup takes priority over sugar/carb heuristics
    to avoid the false-positive where white rice (low actual sugar, high starch GI) gets
    labelled as 'suitable for glycemic management'.
    """
    fiber = n["fiber"]
    sugar = n["sugar"]
    carbs = n["carbs"]
    protein = n["protein"]
    magnesium = n["magnesium"]
    omega3 = n["omega3_ala"] + n["omega3_epa"] + n["omega3_dha"]

    if fiber < 1 and carbs < 5 and protein < 3:
        return None

    food = _food_desc(doc["content"])
    culture = _culture_str(doc["culture"])
    notes = []

    # GI lookup overrides sugar heuristic for starchy staples
    gi_info = _lookup_gi(food)
    if gi_info:
        gi_val, gi_label, gi_direction = gi_info
        if gi_direction == "concern":
            notes.append(
                f"{gi_label} — despite low free-sugar content, the high starch content raises "
                f"postprandial blood glucose significantly; limit portions and pair with fiber and protein"
            )
        else:
            notes.append(
                f"{gi_label} — slower glucose absorption than refined alternatives, "
                f"making it a better carbohydrate choice for T2D management"
            )
    else:
        # Fallback heuristic only when GI is unknown
        if 0 < sugar <= 3 and carbs > 10:
            # Don't say "suitable for glycemic management" unless fiber backs it up
            if fiber >= 2:
                notes.append(f"low sugar ({sugar:.1f}g/100g) with moderate fiber ({fiber:.1f}g/100g) supports glycemic regulation")
        elif sugar > 15:
            notes.append(
                f"high sugar content ({sugar:.1f}g/100g) — consume in moderation; "
                f"pair with protein or fiber to reduce glycemic impact"
            )

    if fiber >= 5:
        notes.append(
            f"high dietary fiber ({fiber:.1f}g/100g) substantially slows glucose absorption "
            f"and reduces postprandial blood glucose response"
        )
    elif fiber >= 2 and not gi_info:
        notes.append(f"moderate dietary fiber ({fiber:.1f}g/100g) contributes to glycemic regulation")

    if magnesium >= 50:
        notes.append(f"high magnesium ({magnesium:.0f}mg/100g) supports insulin sensitivity")
    elif magnesium >= 20:
        notes.append(f"magnesium ({magnesium:.0f}mg/100g) contributes to insulin function")

    if protein >= 10:
        notes.append(f"high protein ({protein:.1f}g/100g) blunts postprandial glucose spike when eaten with carbohydrates")

    if omega3 >= 0.5:
        notes.append(f"omega-3 fatty acids ({omega3:.2f}g/100g) improve insulin sensitivity")

    if not notes:
        return None

    content = (
        f"{food} — Type 2 Diabetes dietary context ({culture} cuisine): "
        f"This food {'; '.join(notes)}. "
        f"Relevant for {culture} individuals managing elevated T2D risk. {_fdc_id(doc)}."
    )

    return {
        "id": f"{doc['id']}_t2d",
        "culture": doc["culture"],
        "condition": "Type 2 Diabetes",
        "content": content,
        "evidence_source": doc["evidence_source"],
    }


def _cad_doc(doc: dict, n: dict) -> dict | None:
    """
    Generate a CAD-relevant document based on saturated fat, sodium, fiber, omega-3.
    """
    sat_fat = n["saturated_fat"]
    fat_total = n["fat_total"]
    sodium = n["sodium"]
    fiber = n["fiber"]
    omega3 = n["omega3_ala"] + n["omega3_epa"] + n["omega3_dha"]
    potassium = n["potassium"]

    # Only generate if there is something meaningful to say about cardiovascular health
    if sat_fat < 1 and sodium < 100 and fiber < 2 and omega3 < 0.3 and potassium < 200:
        return None

    notes = []

    if omega3 >= 1:
        notes.append(
            f"rich in omega-3 fatty acids ({omega3:.2f}g/100g EPA+DHA+ALA), "
            f"which reduce triglycerides, decrease platelet aggregation, and lower cardiovascular risk"
        )
    elif omega3 >= 0.3:
        notes.append(f"contains omega-3 fatty acids ({omega3:.2f}g/100g) with cardioprotective properties")

    if sat_fat >= 8:
        notes.append(
            f"high saturated fat content ({sat_fat:.1f}g/100g) — consume in moderation for cardiovascular health; "
            f"saturated fat raises LDL cholesterol"
        )
    elif sat_fat >= 3:
        notes.append(f"moderate saturated fat ({sat_fat:.1f}g/100g) — balance with unsaturated fat sources")

    if sodium >= 500:
        notes.append(
            f"high sodium content ({sodium:.0f}mg/100g) — patients with hypertension or cardiovascular disease "
            f"should limit portions; rinse or use low-sodium versions where available"
        )
    elif sodium >= 200:
        notes.append(f"moderate sodium ({sodium:.0f}mg/100g) — account for in daily sodium budget")

    if fiber >= 3:
        notes.append(
            f"dietary fiber ({fiber:.1f}g/100g) reduces LDL cholesterol through bile acid sequestration "
            f"and supports cardiovascular health"
        )

    if potassium >= 400:
        notes.append(
            f"high potassium ({potassium:.0f}mg/100g) counterbalances sodium and supports healthy blood pressure"
        )

    if not notes:
        return None

    food = _food_desc(doc["content"])
    culture = _culture_str(doc["culture"])

    content = (
        f"{food} — Coronary artery disease dietary context ({culture} cuisine): "
        f"This food {'; '.join(notes)}. "
        f"Relevant for {culture} individuals with elevated cardiovascular risk or on lipid-lowering medications. "
        f"{_fdc_id(doc)}."
    )

    return {
        "id": f"{doc['id']}_cad",
        "culture": doc["culture"],
        "condition": "coronary artery disease",
        "content": content,
        "evidence_source": doc["evidence_source"],
    }


def _vitamin_d_doc(doc: dict, n: dict) -> dict | None:
    """
    Generate a vitamin D-relevant document if the food is a meaningful source
    (calcium as proxy for dairy foods, actual vitamin D where present).
    """
    calcium = n["calcium"]
    vitamin_d = n["vitamin_d"]
    omega3 = n["omega3_epa"] + n["omega3_dha"]

    if vitamin_d < 1 and calcium < 150 and omega3 < 0.5:
        return None

    notes = []

    if vitamin_d >= 5:
        notes.append(
            f"provides Vitamin D ({vitamin_d:.1f}IU/100g), a direct dietary source for individuals "
            f"with reduced cutaneous synthesis (GC rs2282679 variant, dark skin tone, limited sun exposure)"
        )

    if calcium >= 300:
        notes.append(
            f"very high calcium ({calcium:.0f}mg/100g) — when adequate Vitamin D is present, "
            f"calcium absorption is maximized; low Vitamin D reduces this food's calcium bioavailability by 40-60%"
        )
    elif calcium >= 150:
        notes.append(f"good calcium source ({calcium:.0f}mg/100g) — Vitamin D sufficiency is required for optimal absorption")

    if omega3 >= 0.5:
        notes.append(
            f"omega-3 fatty acids ({omega3:.2f}g/100g) from marine sources often co-occur with Vitamin D "
            f"in fatty fish, one of the few natural dietary Vitamin D sources"
        )

    if not notes:
        return None

    food = _food_desc(doc["content"])
    culture = _culture_str(doc["culture"])

    content = (
        f"{food} — Vitamin D deficiency dietary context ({culture} cuisine): "
        f"This food {'; '.join(notes)}. "
        f"Relevant for {culture} individuals with the GC rs2282679 risk variant or insufficient sun exposure. "
        f"{_fdc_id(doc)}."
    )

    return {
        "id": f"{doc['id']}_vitd",
        "culture": doc["culture"],
        "condition": "vitamin D deficiency",
        "content": content,
        "evidence_source": doc["evidence_source"],
    }


def _caffeine_doc(doc: dict, n: dict) -> dict | None:
    """
    Generate a caffeine metabolism-relevant document if the food contains caffeine.
    """
    caffeine = n["caffeine"]
    if caffeine < 5:
        return None

    food = _food_desc(doc["content"])
    culture = _culture_str(doc["culture"])

    if caffeine >= 200:
        risk_level = "very high caffeine"
        guidance = (
            "For CYP1A2 slow metabolizers (rs762551 AC/CC genotype), a single serving can "
            "maintain elevated blood caffeine for 6-9 hours. Limit to one serving per day and "
            "avoid other caffeine sources on the same day."
        )
    elif caffeine >= 80:
        risk_level = "high caffeine"
        guidance = (
            "CYP1A2 slow metabolizers should limit to 1-2 servings/day and avoid consumption "
            "after early afternoon to prevent sleep disruption."
        )
    elif caffeine >= 30:
        risk_level = "moderate caffeine"
        guidance = (
            "CYP1A2 slow metabolizers may drink 2-3 servings without significant risk, "
            "but should monitor for palpitations, anxiety, or insomnia."
        )
    else:
        risk_level = "low caffeine"
        guidance = "Generally well-tolerated by both fast and slow CYP1A2 metabolizers."

    content = (
        f"{food} — Caffeine metabolism context ({culture} cuisine): "
        f"Contains {caffeine:.0f}mg caffeine per 100g — {risk_level} source. "
        f"{guidance} "
        f"CYP1A2 fast metabolizers (AA genotype) process caffeine 2-3x faster and tolerate higher intake. "
        f"{_fdc_id(doc)}."
    )

    return {
        "id": f"{doc['id']}_caffeine",
        "culture": doc["culture"],
        "condition": "caffeine metabolism",
        "content": content,
        "evidence_source": doc["evidence_source"],
    }


def _ldl_doc(doc: dict, n: dict) -> dict | None:
    """
    Generate elevated LDL-relevant document for foods with strong lipid effects.
    """
    sat_fat = n["saturated_fat"]
    fiber = n["fiber"]
    omega3 = n["omega3_ala"] + n["omega3_epa"] + n["omega3_dha"]
    fat_total = n["fat_total"]

    # Only generate if lipid profile is clearly relevant
    if sat_fat < 3 and fiber < 3 and omega3 < 0.5:
        return None

    notes = []

    if sat_fat >= 10:
        notes.append(
            f"very high saturated fat ({sat_fat:.1f}g/100g) — directly raises LDL cholesterol; "
            f"patients on statins should moderate intake"
        )
    elif sat_fat >= 5:
        notes.append(
            f"moderate saturated fat ({sat_fat:.1f}g/100g) — contributes to LDL elevation; "
            f"balance with unsaturated fat sources in the meal"
        )

    if fiber >= 5:
        notes.append(
            f"high soluble fiber ({fiber:.1f}g/100g) — reduces LDL by sequestering bile acids in the gut; "
            f"evidence-based for cholesterol management"
        )
    elif fiber >= 2:
        notes.append(f"dietary fiber ({fiber:.1f}g/100g) contributes to LDL reduction through bile acid binding")

    if omega3 >= 1:
        notes.append(
            f"omega-3 fatty acids ({omega3:.2f}g/100g) reduce triglycerides and have mild LDL-lowering effects; "
            f"EPA/DHA specifically reduce atherogenic small dense LDL particles"
        )
    elif omega3 >= 0.3:
        notes.append(f"contains omega-3 ({omega3:.2f}g/100g) with favorable lipid effects")

    if not notes:
        return None

    food = _food_desc(doc["content"])
    culture = _culture_str(doc["culture"])

    content = (
        f"{food} — Elevated LDL cholesterol dietary context ({culture} cuisine): "
        f"This food {'; '.join(notes)}. "
        f"Relevant for {culture} individuals with elevated LDL or on lipid-lowering medication (statins). "
        f"{_fdc_id(doc)}."
    )

    return {
        "id": f"{doc['id']}_ldl",
        "culture": doc["culture"],
        "condition": "elevated LDL cholesterol",
        "content": content,
        "evidence_source": doc["evidence_source"],
    }


# ---------------------------------------------------------------------------
# Main enrichment runner
# ---------------------------------------------------------------------------

GENERATORS = [_t2d_doc, _cad_doc, _vitamin_d_doc, _caffeine_doc, _ldl_doc]


def enrich_usda(
    input_path: Path | None = None,
    output_path: Path | None = None,
) -> list[dict]:
    """
    Read usda_corpus_raw.json and emit condition-tagged enriched variants.

    Returns the enriched corpus (does NOT include the original general_nutrition docs).
    Merge with the raw corpus before loading to Supabase if you want both.
    """
    if input_path is None:
        input_path = DATA_DIR / "usda_corpus_raw.json"
    if output_path is None:
        output_path = DATA_DIR / "usda_corpus_enriched.json"

    with open(input_path, encoding="utf-8") as f:
        raw_docs: list[dict] = json.load(f)

    enriched: list[dict] = []
    skipped = 0

    print(f"USDA Corpus Enrichment")
    print(f"  Input: {input_path} ({len(raw_docs)} docs)")
    print()

    for doc in raw_docs:
        nutrients = _extract_all(doc["content"])
        generated = 0

        for generator in GENERATORS:
            result = generator(doc, nutrients)
            if result:
                enriched.append(result)
                generated += 1

        if generated == 0:
            skipped += 1
            print(f"  [SKIP] {doc['id']} - no condition-relevant nutrients")
        else:
            print(f"  [OK]   {doc['id']} -> {generated} condition docs")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False)

    print()
    print(f"Done. {len(enriched)} enriched documents saved to {output_path}")
    print(f"  Skipped (no relevant nutrients): {skipped}")

    conditions: dict[str, int] = {}
    for d in enriched:
        conditions[d["condition"]] = conditions.get(d["condition"], 0) + 1
    print("  Condition breakdown:")
    for cond, count in sorted(conditions.items()):
        print(f"    {cond}: {count}")

    return enriched


if __name__ == "__main__":
    enrich_usda()
