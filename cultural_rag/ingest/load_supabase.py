"""
Embed verified corpus documents and load into Supabase pgvector.

Reads corpus_verified.json, embeds each document using Qwen3-Embedding-8B,
and bulk-upserts into the cultural_nutrition_corpus table.

Features:
- Batched embeddings (32 per Nebius call)
- Bulk Supabase upserts (100 rows per call)
- Resumable: skips docs already in Supabase
- Local embedding cache so a crash doesn't lose work

Usage:
    cd G-Nome
    python -m cultural_rag.ingest.load_supabase
    python -m cultural_rag.ingest.load_supabase --reset       # re-embed everything
    python -m cultural_rag.ingest.load_supabase --no-upload   # embed only, no Supabase
"""

import json
import time
import sys
import os
from pathlib import Path

from cultural_rag.config import nebius_client, EMBED_MODEL, DATA_DIR


EMBED_BATCH = 32          # docs per Nebius embedding call
UPSERT_BATCH = 100        # docs per Supabase upsert call
CACHE_FILE = DATA_DIR / "corpus_embeddings_cache.jsonl"


# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
def _get_supabase():
    """Get the Supabase client from backend/supabase_client.py."""
    try:
        backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
        sys.path.insert(0, str(backend_dir))
        from supabase_client import get_supabase
        sb = get_supabase()
        if sb is not None:
            return sb
    except ImportError:
        pass

    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if url and key:
            return create_client(url, key)
    except ImportError:
        pass
    return None


# ---------------------------------------------------------------------------
# Embedding cache (local JSONL — one row per line, resumable)
# ---------------------------------------------------------------------------
def load_embedding_cache() -> dict[str, list[float]]:
    """Load previously-embedded docs from local cache."""
    if not CACHE_FILE.exists():
        return {}
    cache: dict[str, list[float]] = {}
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                cache[rec["id"]] = rec["embedding"]
            except Exception:
                continue
    return cache


def append_embedding_cache(records: list[dict]) -> None:
    """Append embedding records to local cache (JSONL)."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "a", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------
def embed_batch(texts: list[str], retries: int = 3) -> list[list[float]]:
    """Embed a batch of texts via Nebius. Retries on transient errors."""
    if not nebius_client:
        raise RuntimeError("NEBIUS_API_KEY not set — cannot embed")

    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = nebius_client.embeddings.create(
                model=EMBED_MODEL,
                input=texts,
            )
            return [item.embedding for item in resp.data]
        except Exception as e:
            last_err = e
            wait = 2 ** attempt
            print(f"    [WARN] embed retry {attempt+1}/{retries} after {wait}s — {e}")
            time.sleep(wait)
    raise RuntimeError(f"embed_batch failed after {retries} retries: {last_err}")


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------
def get_existing_ids(sb) -> set[str]:
    """Fetch all IDs already in Supabase so we can skip them on resume."""
    existing: set[str] = set()
    page = 0
    page_size = 1000
    while True:
        resp = (
            sb.table("cultural_nutrition_corpus")
            .select("id")
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break
        existing.update(r["id"] for r in rows)
        if len(rows) < page_size:
            break
        page += 1
    return existing


def upsert_batch(sb, rows: list[dict]) -> int:
    """Upsert a batch of rows. Returns count successfully upserted."""
    try:
        sb.table("cultural_nutrition_corpus").upsert(rows).execute()
        return len(rows)
    except Exception as e:
        # Fall back to per-row insert so a single bad row doesn't block the batch
        print(f"    [WARN] bulk upsert failed — falling back to per-row. {e}")
        ok = 0
        for r in rows:
            try:
                sb.table("cultural_nutrition_corpus").upsert(r).execute()
                ok += 1
            except Exception as e2:
                print(f"      [ERR] {r['id']}: {e2}")
        return ok


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def load_to_supabase(
    input_path: Path | None = None,
    reset: bool = False,
    no_upload: bool = False,
) -> dict:
    """Embed + upsert all verified corpus documents into Supabase."""
    if input_path is None:
        input_path = DATA_DIR / "corpus_verified.json"

    if not input_path.exists():
        print(f"ERROR: {input_path} not found. Run verify_docs first.")
        return {"error": "input not found"}

    with open(input_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    print(f"Loading corpus into Supabase pgvector")
    print(f"  Source: {input_path.name}")
    print(f"  Documents: {len(docs)}")
    print(f"  Embed batch: {EMBED_BATCH}    Upsert batch: {UPSERT_BATCH}")

    # ---- Resume support ----
    if reset and CACHE_FILE.exists():
        CACHE_FILE.unlink()
        print("  Reset: deleted local embedding cache")

    cache = load_embedding_cache()
    print(f"  Embedding cache: {len(cache)} docs already embedded locally")

    sb = None if no_upload else _get_supabase()
    if sb is None and not no_upload:
        print("  [WARN] Supabase not configured — running embed-only mode")
        no_upload = True

    existing_in_db: set[str] = set()
    if sb is not None:
        existing_in_db = get_existing_ids(sb)
        print(f"  Already in Supabase: {len(existing_in_db)} docs (will skip)")

    # ---- Step 1: embed any docs not already in cache ----
    to_embed = [d for d in docs if d["id"] not in cache]
    print(f"  To embed this run: {len(to_embed)}")

    if to_embed:
        start = time.time()
        for i in range(0, len(to_embed), EMBED_BATCH):
            batch = to_embed[i : i + EMBED_BATCH]
            texts = [d["content"] for d in batch]
            embeddings = embed_batch(texts)

            records = [
                {"id": d["id"], "embedding": emb}
                for d, emb in zip(batch, embeddings)
            ]
            append_embedding_cache(records)
            for rec in records:
                cache[rec["id"]] = rec["embedding"]

            done = min(i + EMBED_BATCH, len(to_embed))
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (len(to_embed) - done) / rate if rate > 0 else 0
            print(
                f"    embed {done}/{len(to_embed)} "
                f"({rate:.1f} docs/s, ETA {eta:.0f}s)"
            )
        print(f"  [OK] Embedded {len(to_embed)} new docs in {time.time()-start:.1f}s")

    dim = len(next(iter(cache.values()))) if cache else 0
    print(f"  Embedding dim: {dim}")

    # ---- Step 2: upsert into Supabase ----
    if no_upload:
        print("  Skipping Supabase upload (no_upload=True)")
        return {
            "total": len(docs),
            "embedded_total": len(cache),
            "dimension": dim,
            "uploaded": False,
        }

    # Skip docs already in DB
    to_upload = [d for d in docs if d["id"] not in existing_in_db]
    print(f"  To upload this run: {len(to_upload)}")

    upserted = 0
    start = time.time()
    for i in range(0, len(to_upload), UPSERT_BATCH):
        batch = to_upload[i : i + UPSERT_BATCH]
        rows = [
            {
                "id": d["id"],
                "culture": d["culture"],
                "condition": d["condition"],
                "content": d["content"],
                "evidence_source": d["evidence_source"],
                "embedding": cache[d["id"]],
            }
            for d in batch
            if d["id"] in cache
        ]
        ok = upsert_batch(sb, rows)
        upserted += ok

        done = min(i + UPSERT_BATCH, len(to_upload))
        elapsed = time.time() - start
        rate = done / elapsed if elapsed > 0 else 0
        eta = (len(to_upload) - done) / rate if rate > 0 else 0
        print(f"    upsert {done}/{len(to_upload)} ({rate:.1f} docs/s, ETA {eta:.0f}s)")

    print(f"  [OK] Upserted {upserted} docs to Supabase in {time.time()-start:.1f}s")

    # Final verify
    final_count = 0
    try:
        r = sb.table("cultural_nutrition_corpus").select("id", count="exact").limit(1).execute()
        final_count = r.count or 0
    except Exception:
        pass

    return {
        "total_docs_in_file": len(docs),
        "embedded_total": len(cache),
        "dimension": dim,
        "newly_upserted": upserted,
        "supabase_row_count": final_count,
        "uploaded": True,
    }


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    no_upload = "--no-upload" in sys.argv
    result = load_to_supabase(reset=reset, no_upload=no_upload)
    print()
    print(f"Summary: {json.dumps(result, indent=2)}")
