"""
Pull nutritional data from USDA FoodData Central for cultural food lists.

For each culture -> each food, queries the USDA API and builds corpus documents
with nutrient profiles and cultural context.

Usage:
    cd backend
    python -m cultural_rag.ingest.pull_usda
"""

import json
import time
import sys
import re
import requests
from pathlib import Path

from cultural_rag.config import (
    USDA_API_KEY, USDA_SEARCH_URL, CULTURE_FOODS, DATA_DIR, CULTURE_HIERARCHY
)


def _slugify(text: str) -> str:
    """Convert text to a URL/ID-safe slug."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _extract_nutrient(nutrients: list[dict], name: str) -> str:
    """Extract a nutrient value+unit from USDA nutrient list."""
    for n in nutrients:
        if name.lower() in n.get("nutrientName", "").lower():
            val = n.get("value", 0)
            unit = n.get("unitName", "")
            return f"{val}{unit}"
    return "N/A"


def _build_content(food_query: str, culture: str, fdc_data: dict) -> str:
    """Build a human-readable corpus document from USDA search result."""
    desc = fdc_data.get("description", food_query)
    fdc_id = fdc_data.get("fdcId", "unknown")
    nutrients = fdc_data.get("foodNutrients", [])

    # Extract EVERYTHING
    nutrient_strings = []
    for n in nutrients:
        name = n.get("nutrientName", "Unknown")
        val = n.get("value", 0)
        unit = n.get("unitName", "")
        if val > 0:  # Only include non-zero nutrients to save space
            nutrient_strings.append(f"{name}: {val}{unit}")
            
    nutrient_text = ", ".join(nutrient_strings)
    
    # Get macro culture fallback
    macro_culture = CULTURE_HIERARCHY.get(culture, culture)
    if macro_culture != culture:
        culture_str = f"{culture} ({macro_culture})"
    else:
        culture_str = culture

    content = (
        f"{desc} (USDA fdcId:{fdc_id}): {nutrient_text} per 100g. "
        f"A food commonly consumed in {culture_str} dietary traditions."
    )
    return content


def pull_usda(
    delay: float = 1.5,
    output_path: Path | None = None,
) -> list[dict]:
    """
    Pull USDA FoodData Central data for all culture × food combinations.

    Args:
        delay: Seconds to sleep between API calls (rate limiting).
        output_path: Where to save the raw JSON. Defaults to data/usda_corpus_raw.json.

    Returns:
        List of corpus document dicts.
    """
    if output_path is None:
        output_path = DATA_DIR / "usda_corpus_raw.json"

    corpus: list[dict] = []
    errors: list[str] = []
    total_foods = sum(len(foods) for foods in CULTURE_FOODS.values())

    print(f"USDA FoodData Central Pull")
    print(f"  API key: {'custom' if USDA_API_KEY != 'DEMO_KEY' else 'DEMO_KEY (rate-limited)'}")
    print(f"  Cultures: {len(CULTURE_FOODS)}")
    print(f"  Total foods: {total_foods}")
    print()

    # Define the 3 fallback tiers
    search_tiers = [
        {"dataType": "Foundation,SR Legacy", "requireAllWords": "true"},
        {"dataType": "Foundation,SR Legacy", "requireAllWords": "false"},
        {"dataType": "Branded", "requireAllWords": "false"}
    ]

    idx = 0
    for culture, foods in CULTURE_FOODS.items():
        print(f"  [{culture}]")
        for food in foods:
            idx += 1
            
            results = []
            for tier in search_tiers:
                params = {
                    "query": food,
                    "api_key": USDA_API_KEY,
                    "pageSize": 5,
                    "dataType": tier["dataType"],
                    "requireAllWords": tier["requireAllWords"],
                }

                try:
                    resp = requests.get(USDA_SEARCH_URL, params=params, timeout=15)
                    if resp.status_code == 429:
                        print("    [WARN] Rate limit hit. Sleeping 10s...")
                        time.sleep(10)
                        resp = requests.get(USDA_SEARCH_URL, params=params, timeout=15)
                    resp.raise_for_status()
                    data = resp.json()
                    results = data.get("foods", [])
                    if results:
                        break # Found something, stop falling back
                except Exception as e:
                    print(f"    [WARN] API error on {food}: {e}")
                
                time.sleep(delay)

            if not results:
                err = f"    [ERR] {food}: no results across all fallback tiers"
                print(err)
                errors.append(err)
                continue

            # Sort by shortest description length to prioritize base ingredients over complex products
            results.sort(key=lambda x: len(x.get("description", "")))
            fdc_data = results[0]
            
            fdc_id = fdc_data.get("fdcId", "unknown")
            content = _build_content(food, culture, fdc_data)

            doc = {
                "id": f"{_slugify(culture)}_{_slugify(food)}_{fdc_id}",
                "culture": culture,
                "condition": "general_nutrition",
                "content": content,
                "evidence_source": f"USDA fdcId:{fdc_id}",
            }
            corpus.append(doc)
            print(f"    [OK] {food} -> fdcId:{fdc_id} ({idx}/{total_foods})")

            time.sleep(delay)

    # Save output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)

    print()
    print(f"Done. {len(corpus)} documents saved to {output_path}")
    if errors:
        print(f"  {len(errors)} errors:")
        for e in errors:
            print(f"    {e}")

    return corpus


if __name__ == "__main__":
    pull_usda()
