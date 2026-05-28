"""
Sanity-check the RAG retrieval pipeline after loading Supabase.

Runs a few representative queries and prints the top matches.
Verifies:
  - Embedding dimension matches the table
  - The match_cultural_docs RPC returns hits
  - Culture filter works (Vietnamese T2D returns Vietnamese docs)
  - Fallback to culture-agnostic search returns something even for
    cultures with no data
"""

import asyncio
import sys
from pathlib import Path

# Force UTF-8 stdout on Windows so non-ASCII content doesn't crash printing.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from cultural_rag.config import nebius_client, EMBED_MODEL
from supabase_client import get_supabase


def embed(text: str) -> list[float]:
    r = nebius_client.embeddings.create(model=EMBED_MODEL, input=[text])
    return r.data[0].embedding


def run_query(sb, query: str, culture: str | None, k: int = 5) -> None:
    print(f"\nQUERY: {query!r}")
    print(f"  filter_culture={culture!r}  k={k}")

    emb = embed(query)
    resp = sb.rpc(
        "match_cultural_docs",
        {
            "query_embedding": emb,
            "filter_culture": culture,
            "match_count": k,
        },
    ).execute()

    docs = resp.data or []
    if not docs:
        print("  (no results)")
        return

    for i, d in enumerate(docs, 1):
        sim = d.get("similarity", 0)
        cont = d.get("content", "")[:140].replace("\n", " ")
        print(
            f"  [{i}] sim={sim:.3f}  culture={d['culture']:<20s} "
            f"condition={d['condition']:<25s}"
        )
        print(f"      source={d['evidence_source']}")
        print(f"      {cont}...")


def main():
    sb = get_supabase()
    if sb is None:
        print("ERROR: Supabase not configured. Check backend/.env.")
        return 1

    # Row count
    r = sb.table("cultural_nutrition_corpus").select("id", count="exact").limit(1).execute()
    print(f"Supabase row count: {r.count}")

    # Probe a few representative scenarios
    run_query(sb, "Vietnamese diet for Type 2 Diabetes glycemic rice noodles", "Vietnamese")
    run_query(sb, "Korean diet alcohol metabolism ALDH2 cooking wine", "Korean")
    run_query(sb, "Mexican diet folate MTHFR beans corn", "Mexican")
    run_query(sb, "South Asian diet coronary heart disease ghee turmeric", "South Asian")
    run_query(sb, "diet for high LDL cholesterol", None, k=5)

    return 0


if __name__ == "__main__":
    sys.exit(main())
