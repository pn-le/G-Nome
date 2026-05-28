"""
Retrieval step — embed the query, call Supabase match_cultural_docs RPC.

The query is a short composed string ("{culture} diet for {risks} while on {drugs}")
which is what the corpus was indexed against — keep it short and concrete.
"""

from __future__ import annotations
from typing import Any

from supabase import Client

from cultural_rag.schemas import GenomicProfile
from cultural_rag.runtime import async_nebius_client, EMBED_MODEL


def build_query(profile: GenomicProfile, culture: str) -> str:
    """Compose a retrieval query string from the profile."""
    risk_labels = [r.condition for r in profile.metabolic_risks] or []
    carrier_labels = [c.condition for c in profile.carrier_hits] or []
    conditions = ", ".join(risk_labels + carrier_labels) or "general health"

    drugs = ", ".join(profile.flagged_drugs) if profile.flagged_drugs else ""
    drug_clause = f" while on {drugs}" if drugs else ""

    return f"{culture} diet for {conditions}{drug_clause}"


async def embed_query(text: str) -> list[float]:
    """Embed a single text via Nebius Qwen3-Embedding-8B."""
    if not async_nebius_client:
        raise RuntimeError("NEBIUS_API_KEY not set — cannot embed query")

    resp = await async_nebius_client.embeddings.create(
        model=EMBED_MODEL,
        input=[text],
    )
    return resp.data[0].embedding


async def retrieve(
    profile: GenomicProfile,
    culture: str,
    supabase: Client,
    k: int = 5,
) -> list[dict[str, Any]]:
    """
    Run the RAG retrieval step.

    Returns up to `k` corpus rows ordered by cosine similarity, each shaped:
        {id, culture, condition, content, evidence_source, similarity}
    """
    if supabase is None:
        return []

    query_text = build_query(profile, culture)
    embedding = await embed_query(query_text)

    response = supabase.rpc(
        "match_cultural_docs",
        {
            "query_embedding": embedding,
            "filter_culture": culture,
            "match_count": k,
        },
    ).execute()

    docs = response.data or []

    # Fall back to culture-agnostic retrieval if culture filter produced nothing
    if not docs:
        response = supabase.rpc(
            "match_cultural_docs",
            {
                "query_embedding": embedding,
                "filter_culture": None,
                "match_count": k,
            },
        ).execute()
        docs = response.data or []

    return docs
