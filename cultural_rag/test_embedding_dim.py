"""
Phase 0 — One-shot embedding dimension test.

Run this ONCE to discover the output dimension of Qwen/Qwen3-Embedding-8B.
The result tells you what vector(N) to set in your Supabase table.

Usage:
    cd backend
    python -m cultural_rag.test_embedding_dim
"""

import sys
from cultural_rag.config import nebius_client, EMBED_MODEL


def test_embedding_dim() -> int:
    """Call the embedding API with a test string. Return the dimension."""
    if not nebius_client:
        print("ERROR: NEBIUS_API_KEY not set. Add it to .env and retry.")
        sys.exit(1)

    print(f"Calling {EMBED_MODEL} with a test input...")
    print(f"Base URL: {nebius_client.base_url}")
    print()

    try:
        response = nebius_client.embeddings.create(
            model=EMBED_MODEL,
            input=["G-Nome cultural nutrition embedding dimension test"],
        )
    except Exception as e:
        print(f"ERROR: API call failed: {e}")
        print()
        print("Possible causes:")
        print("  1. NEBIUS_API_KEY is invalid or expired")
        print("  2. NEBIUS_BASE_URL is wrong (try api.studio.nebius.com or api.tokenfactory.nebius.com)")
        print(f"  3. Model '{EMBED_MODEL}' is not available on this platform")
        sys.exit(1)

    embedding = response.data[0].embedding
    dim = len(embedding)

    print(f"[OK] SUCCESS")
    print(f"   Model:     {response.model}")
    print(f"   Dimension: {dim}")
    print(f"   First 5:   {embedding[:5]}")
    print(f"   Usage:     {response.usage}")
    print()
    print(f"==> Set your Supabase column to: vector({dim})")
    print(f"   Update cultural_corpus.sql with this value.")

    return dim


if __name__ == "__main__":
    test_embedding_dim()
