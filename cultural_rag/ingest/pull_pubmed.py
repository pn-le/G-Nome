"""
Pull abstracts from PubMed (NCBI Entrez) for culture x condition pairs.

Filters to systematic reviews and RCTs only. Respects rate limits.

Usage:
    cd backend
    python -m cultural_rag.ingest.pull_pubmed
"""

import json
import time
import re
import sys
import xml.etree.ElementTree as ET
import requests
from pathlib import Path

from cultural_rag.config import PUBMED_QUERIES, DATA_DIR


ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

# Optional: set NCBI_API_KEY in env for higher rate limit (10/sec vs 3/sec)
import os
NCBI_API_KEY = os.environ.get("NCBI_API_KEY", "") or os.environ.get("NCBI_KEY", "")


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _esearch(query: str, retmax: int = 5) -> list[str]:
    """Search PubMed and return up to retmax PMIDs."""
    # Append filter for systematic reviews or RCTs
    full_query = f"{query} AND (systematic review[pt] OR randomized controlled trial[pt])"

    params = {
        "db": "pubmed",
        "term": full_query,
        "retmax": retmax,
        "retmode": "json",
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY

    resp = requests.get(ESEARCH_URL, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    id_list = data.get("esearchresult", {}).get("idlist", [])
    return id_list


def _efetch(pmids: list[str]) -> list[dict]:
    """Fetch article details for a list of PMIDs. Returns parsed dicts."""
    if not pmids:
        return []

    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "rettype": "abstract",
        "retmode": "xml",
    }
    if NCBI_API_KEY:
        params["api_key"] = NCBI_API_KEY

    resp = requests.get(EFETCH_URL, params=params, timeout=30)
    resp.raise_for_status()

    articles = []
    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        return []

    for article_elem in root.findall(".//PubmedArticle"):
        pmid_elem = article_elem.find(".//PMID")
        title_elem = article_elem.find(".//ArticleTitle")
        abstract_elem = article_elem.find(".//AbstractText")
        year_elem = article_elem.find(".//PubDate/Year")

        pmid = pmid_elem.text if pmid_elem is not None else None
        title = title_elem.text if title_elem is not None else None
        year = year_elem.text if year_elem is not None else None

        # AbstractText can have multiple sections
        abstract_parts = []
        for abs_elem in article_elem.findall(".//AbstractText"):
            label = abs_elem.get("Label", "")
            text = abs_elem.text or ""
            # Also capture tail text and child elements
            full_text = ET.tostring(abs_elem, encoding="unicode", method="text").strip()
            if label:
                abstract_parts.append(f"{label}: {full_text}")
            else:
                abstract_parts.append(full_text)

        abstract = " ".join(abstract_parts).strip()

        if pmid and abstract:
            articles.append({
                "pmid": pmid,
                "title": title or "Untitled",
                "abstract": abstract,
                "year": year or "Unknown",
            })

    return articles


def pull_pubmed(
    delay: float = 0.4,
    retmax_per_query: int = 5,
    output_path: Path | None = None,
) -> list[dict]:
    """
    Pull PubMed abstracts for all culture × condition queries.

    Args:
        delay: Seconds between API calls.
        retmax_per_query: Max PMIDs to fetch per search query.
        output_path: Where to save. Defaults to data/pubmed_corpus_raw.json.

    Returns:
        List of corpus document dicts.
    """
    if output_path is None:
        output_path = DATA_DIR / "pubmed_corpus_raw.json"

    corpus: list[dict] = []
    seen_pmids: set[str] = set()  # deduplicate across queries
    errors: list[str] = []

    print(f"PubMed Entrez Pull")
    print(f"  Queries: {len(PUBMED_QUERIES)}")
    print(f"  Max PMIDs per query: {retmax_per_query}")
    print(f"  NCBI API key: {'set' if NCBI_API_KEY else 'not set (3 req/sec limit)'}")
    print()

    for i, (culture, condition, search_terms) in enumerate(PUBMED_QUERIES):
        print(f"  [{i+1}/{len(PUBMED_QUERIES)}] {culture} / {condition}")

        # Step 1: Search
        try:
            pmids = _esearch(search_terms, retmax=retmax_per_query)
        except Exception as e:
            err = f"    [ERR] esearch failed: {e}"
            print(err)
            errors.append(err)
            time.sleep(delay)
            continue

        # Filter out already-seen PMIDs
        new_pmids = [p for p in pmids if p not in seen_pmids]
        if not new_pmids:
            print(f"    [--] no new results (all duplicates or empty)")
            time.sleep(delay)
            continue

        time.sleep(delay)

        # Step 2: Fetch
        try:
            articles = _efetch(new_pmids)
        except Exception as e:
            err = f"    [ERR] efetch failed: {e}"
            print(err)
            errors.append(err)
            time.sleep(delay)
            continue

        for article in articles:
            pmid = article["pmid"]
            if pmid in seen_pmids:
                continue
            seen_pmids.add(pmid)

            content = (
                f"{article['title']}. "
                f"{article['abstract']} "
                f"Published: {article['year']}."
            )

            doc = {
                "id": f"{_slugify(culture)}_{_slugify(condition)}_pmid{pmid}",
                "culture": culture,
                "condition": condition,
                "content": content,
                "evidence_source": f"PMID:{pmid}",
            }
            corpus.append(doc)
            print(f"    [OK] PMID:{pmid} - {article['title'][:60]}...")

        time.sleep(delay)

    # Save output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)

    print()
    print(f"Done. {len(corpus)} documents saved to {output_path}")
    print(f"  Unique PMIDs: {len(seen_pmids)}")
    if errors:
        print(f"  {len(errors)} errors:")
        for e in errors:
            print(f"    {e}")

    return corpus


if __name__ == "__main__":
    pull_pubmed()
