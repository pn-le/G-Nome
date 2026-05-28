"""
Verify and repair PMIDs in hand-curated corpus documents.

For each doc with an evidence_source of "PMID:XXXXXX":
1. Fetch the paper from PubMed and check it exists.
2. Print the actual title so you can confirm it matches the claimed content.
3. If the PMID doesn't exist, search PubMed with keywords from the doc content
   and suggest the closest matching real PMID.

This is a read-only audit script — it does NOT modify any files.
Fix discrepancies manually in the JSON.

Usage:
    cd backend
    python -m cultural_rag.ingest.verify_handcurated_pmids
"""

import json
import time
import re
import os
import xml.etree.ElementTree as ET
import requests
from pathlib import Path

from cultural_rag.config import DATA_DIR

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
NCBI_API_KEY = os.environ.get("NCBI_API_KEY", "")


def _fetch_pmid(pmid: str) -> dict | None:
    """Fetch title and abstract for a single PMID. Returns None if not found."""
    params = {
        "db": "pubmed",
        "id": pmid,
        "rettype": "abstract",
        "retmode": "xml",
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY

    try:
        resp = requests.get(EFETCH_URL, params=params, timeout=15)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

        title_elem = root.find(".//ArticleTitle")
        abstract_elem = root.find(".//AbstractText")
        year_elem = root.find(".//PubDate/Year")

        title = title_elem.text if title_elem is not None else None
        abstract = abstract_elem.text if abstract_elem is not None else None
        year = year_elem.text if year_elem is not None else None

        if title is None:
            return None

        return {"pmid": pmid, "title": title, "year": year, "has_abstract": abstract is not None}

    except Exception as e:
        return {"pmid": pmid, "error": str(e)}


def _search_pmid(keywords: str, retmax: int = 3) -> list[dict]:
    """Search PubMed for keywords, return top results with titles."""
    query = f"{keywords} AND (systematic review[pt] OR randomized controlled trial[pt])"
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": retmax,
        "retmode": "json",
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY

    try:
        resp = requests.get(ESEARCH_URL, params=params, timeout=15)
        resp.raise_for_status()
        ids = resp.json().get("esearchresult", {}).get("idlist", [])
    except Exception:
        return []

    if not ids:
        return []

    time.sleep(0.4)

    results = []
    for pmid in ids:
        info = _fetch_pmid(pmid)
        if info and "title" in info:
            results.append(info)
        time.sleep(0.3)

    return results


def _extract_keywords(content: str, max_words: int = 8) -> str:
    """Extract key medical/food terms from content for fallback search."""
    # Remove parenthetical citations and USDA refs
    text = re.sub(r'\(USDA[^)]+\)', '', content)
    text = re.sub(r'PMID:\d+', '', text)
    # Take first 2 sentences
    sentences = text.split('.')[:2]
    combined = ' '.join(sentences)
    # Extract meaningful words (>4 chars, not common stopwords)
    stopwords = {'this', 'that', 'with', 'from', 'have', 'been', 'also', 'their',
                 'they', 'some', 'when', 'which', 'about', 'more', 'than', 'into'}
    words = [w for w in re.findall(r'\b[a-zA-Z]{4,}\b', combined)
             if w.lower() not in stopwords]
    return ' '.join(words[:max_words])


def verify_handcurated_pmids(handcurated_dir: Path | None = None) -> None:
    if handcurated_dir is None:
        handcurated_dir = DATA_DIR / "handcurated"

    all_docs = []
    for hc_file in sorted(handcurated_dir.glob("*.json")):
        docs = json.load(open(hc_file, encoding="utf-8"))
        all_docs.extend(docs)

    pmid_docs = [d for d in all_docs if d.get("evidence_source", "").startswith("PMID:")]
    print(f"Hand-curated PMID verification")
    print(f"  Total docs: {len(all_docs)}")
    print(f"  Docs with PMIDs: {len(pmid_docs)}")
    print(f"  NCBI API key: {'set' if NCBI_API_KEY else 'not set (3 req/sec limit)'}")
    print()

    ok_count = 0
    bad_count = 0
    error_count = 0

    for doc in pmid_docs:
        pmid = doc["evidence_source"].replace("PMID:", "").strip()
        print(f"[{doc['id']}]")
        print(f"  Claimed PMID: {pmid}")
        print(f"  Condition: {doc['condition']}")

        result = _fetch_pmid(pmid)
        time.sleep(0.4)

        if result is None:
            print(f"  STATUS: NOT FOUND")
            bad_count += 1

            # Try to find the real paper
            keywords = _extract_keywords(doc["content"])
            print(f"  Searching for: '{keywords}'")
            suggestions = _search_pmid(keywords)
            time.sleep(0.4)

            if suggestions:
                print(f"  SUGGESTED replacements:")
                for s in suggestions:
                    print(f"    PMID:{s['pmid']} ({s.get('year','?')}) — {s['title'][:80]}")
            else:
                print(f"  No suggestions found. Write a manual search.")

        elif "error" in result:
            print(f"  STATUS: ERROR — {result['error']}")
            error_count += 1

        else:
            status = "OK" if result["has_abstract"] else "OK (no abstract)"
            print(f"  STATUS: {status}")
            print(f"  Title: {result['title'][:90]}")
            print(f"  Year: {result.get('year', 'unknown')}")

            # Warn if title looks unrelated to the doc content
            content_words = set(doc["content"].lower().split())
            title_words = set(result["title"].lower().split())
            overlap = content_words & title_words - {'the', 'a', 'of', 'in', 'and', 'to', 'for', 'with'}
            if len(overlap) < 2:
                print(f"  WARN: Title may not match content — low keyword overlap ({overlap})")
            ok_count += 1

        print()

    print(f"Summary: {ok_count} OK, {bad_count} not found, {error_count} errors")
    print()
    print("Fix discrepancies manually in the JSON files.")
    print("Use the suggested PMIDs above or search PubMed at:")
    print("  https://pubmed.ncbi.nlm.nih.gov/?term=YOUR+KEYWORDS&filter=pubt.systematicreview&filter=pubt.randomizedcontrolledtrial")


if __name__ == "__main__":
    verify_handcurated_pmids()
