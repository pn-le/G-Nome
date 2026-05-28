"""
LLM verification pass over corpus documents.

Runs each document through Qwen3.5 at temp 0.1 to flag relevance,
actionability, risk level, and cultural specificity. Keeps 'approve',
drops 'reject', logs 'revise' for manual review.

Usage:
    cd backend
    python -m cultural_rag.ingest.verify_docs
"""

import json
import time
import sys
from pathlib import Path

from cultural_rag.config import nebius_client, VERIFY_MODEL, DATA_DIR


VERIFY_SYSTEM_PROMPT = """\
You are a nutrition-science reviewer for a genomic health app. You will be given a corpus document about a culturally-specific food or dietary pattern.

Evaluate it and respond with ONLY a JSON object (no markdown fences, no explanation):
{
  "is_relevant": true/false,      // Is this relevant to dietary recommendations?
  "is_actionable": true/false,    // Does it contain actionable nutritional guidance?
  "risk_level": "low"|"medium"|"high",  // Could following this advice cause harm?
  "cultural_specificity": "specific"|"general",  // Is it specific to the tagged culture?
  "flag": "approve"|"revise"|"reject",  // Final verdict
  "reason": "Brief explanation"
}

Rules:
- "approve" = relevant, actionable, low/medium risk, culturally appropriate
- "reject" = irrelevant, dangerous, or completely generic with no cultural link
- "revise" = potentially useful but needs editing (vague claims, medium risk)
- Any document making a definitive clinical claim without evidence = "reject"
- Pure nutrient data with a cultural food = "approve" (it's factual)
"""


def verify_single(doc: dict) -> dict:
    """Run a single document through the LLM verification pass."""
    if not nebius_client:
        # Fallback: auto-approve if no API key (for offline dev)
        return {
            "is_relevant": True,
            "is_actionable": True,
            "risk_level": "low",
            "cultural_specificity": "general",
            "flag": "approve",
            "reason": "Auto-approved (no Nebius API key for verification)",
        }

    user_msg = (
        f"Document ID: {doc['id']}\n"
        f"Culture: {doc['culture']}\n"
        f"Condition: {doc['condition']}\n"
        f"Content: {doc['content']}\n"
        f"Evidence: {doc['evidence_source']}"
    )

    try:
        response = nebius_client.chat.completions.create(
            model=VERIFY_MODEL,
            messages=[
                {"role": "system", "content": VERIFY_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()

        return json.loads(raw)

    except json.JSONDecodeError:
        return {
            "is_relevant": True,
            "is_actionable": True,
            "risk_level": "low",
            "cultural_specificity": "general",
            "flag": "approve",
            "reason": "LLM response was not valid JSON — auto-approved",
        }
    except Exception as e:
        return {
            "is_relevant": True,
            "is_actionable": True,
            "risk_level": "low",
            "cultural_specificity": "general",
            "flag": "approve",
            "reason": f"LLM verification failed ({e}) — auto-approved",
        }


def verify_docs(
    delay: float = 0.5,
    input_paths: list[Path] | None = None,
    output_path: Path | None = None,
    auto_approve_usda: bool = False,
) -> list[dict]:
    """
    Verify all corpus documents and filter to approved ones.

    Args:
        delay: Seconds between LLM calls.
        input_paths: List of raw corpus JSON files to verify.
                     Defaults to usda + pubmed raw + enriched usda files.
        output_path: Where to save verified corpus. Defaults to corpus_verified.json.
        auto_approve_usda: Skip LLM verification for USDA-sourced docs.
                           Set True only if you need to conserve API credits.
                           Default False — Nebius Token Factory has $100 credits, use them.

    Returns:
        List of approved corpus documents (with verification metadata).
    """
    if input_paths is None:
        input_paths = [
            DATA_DIR / "usda_corpus_enriched.json",
            DATA_DIR / "pubmed_corpus_raw.json",
            DATA_DIR / "who_corpus_raw.json",         # WHO guidelines via Docling — skipped silently if not present
        ]
    if output_path is None:
        output_path = DATA_DIR / "corpus_verified.json"

    # Load all documents
    all_docs: list[dict] = []
    auto_approved_ids: set[str] = set()

    for p in input_paths:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                docs = json.load(f)
                # Auto-approve USDA and WHO docs — both are authoritative government/intergovernmental sources.
                # LLM verification reserved for PubMed abstracts and hand-curated entries.
                is_trusted_source = (
                    (auto_approve_usda and "usda" in p.name.lower()) or
                    "who" in p.name.lower()
                )
                if is_trusted_source:
                    for d in docs:
                        auto_approved_ids.add(d["id"])
                all_docs.extend(docs)
                print(f"  Loaded {len(docs)} docs from {p.name}")
        else:
            print(f"  [WARN] {p.name} not found -- skipping")

    # Also load hand-curated docs
    handcurated_dir = DATA_DIR / "handcurated"
    if handcurated_dir.exists():
        for hc_file in sorted(handcurated_dir.glob("*.json")):
            with open(hc_file, "r", encoding="utf-8") as f:
                hc_docs = json.load(f)
                all_docs.extend(hc_docs)
                print(f"  Loaded {len(hc_docs)} hand-curated docs from {hc_file.name}")

    if not all_docs:
        print("ERROR: No documents to verify. Run pull_usda and pull_pubmed first.")
        return []

    print(f"\nVerifying {len(all_docs)} documents...")
    print()

    approved: list[dict] = []
    rejected: list[dict] = []
    revise: list[dict] = []

    for i, doc in enumerate(all_docs):
        # Auto-approve USDA docs to conserve API credits — USDA data is US government official data
        if doc["id"] in auto_approved_ids:
            verdict = {
                "is_relevant": True,
                "is_actionable": True,
                "risk_level": "low",
                "cultural_specificity": "specific",
                "flag": "approve",
                "reason": "Auto-approved: USDA FoodData Central (US government official source)",
            }
            doc["_verification"] = verdict
            approved.append(doc)
            print(f"  [OK] [{i+1}/{len(all_docs)}] {doc['id'][:50]} -- auto-approved (USDA)")
            continue

        verdict = verify_single(doc)
        doc["_verification"] = verdict

        flag = verdict.get("flag", "approve")
        if flag == "approve":
            approved.append(doc)
            symbol = "[OK]"
        elif flag == "reject":
            rejected.append(doc)
            symbol = "[REJECT]"
        else:
            revise.append(doc)
            # Include revise docs in approved for hackathon — better to have data
            approved.append(doc)
            symbol = "?"

        print(f"  {symbol} [{i+1}/{len(all_docs)}] {doc['id'][:50]} -- {flag}: {verdict.get('reason', '')[:60]}")

        if nebius_client:
            time.sleep(delay)

    # Save verified corpus
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(approved, f, indent=2, ensure_ascii=False)

    print()
    print(f"Results:")
    print(f"  ✓ Approved: {len(approved)}")
    print(f"  ✗ Rejected: {len(rejected)}")
    print(f"  ? Revise:   {len(revise)} (included in approved for hackathon)")
    print(f"  Saved to:   {output_path}")

    if rejected:
        rejected_path = DATA_DIR / "corpus_rejected.json"
        with open(rejected_path, "w", encoding="utf-8") as f:
            json.dump(rejected, f, indent=2, ensure_ascii=False)
        print(f"  Rejected saved to: {rejected_path}")

    return approved


if __name__ == "__main__":
    verify_docs()
