"""Retrieval-Augmented Generation (RAG) utilities using Nebius Embeddings & Supabase pgvector."""

import os
from openai import AsyncOpenAI
from .supabase_client import get_supabase

_client = None

def _get_client() -> AsyncOpenAI | None:
    global _client
    api_key = os.environ.get("NEBIUS_API_KEY", "")
    if not api_key:
        return None
    if _client is None:
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url=os.environ.get("NEBIUS_BASE_URL", "https://api.studio.nebius.com/v1/"),
        )
    return _client

async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate 4096-dimensional embeddings for a batch of strings in one API call."""
    client = _get_client()
    if not client or not texts:
        return []
    
    # Replace newlines as recommended for embeddings
    clean_texts = [text.replace("\n", " ") for text in texts]
    
    try:
        response = await client.embeddings.create(
            model="Qwen/Qwen3-Embedding-8B",
            input=clean_texts
        )
        # Ensure they are sorted by the original input index
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
    except Exception as e:
        print(f"Error generating embeddings batch: {e}")
        return []

async def get_embedding(text: str) -> list[float]:
    """Generate a 4096-dimensional embedding using Qwen3-Embedding-8B."""
    embeddings = await get_embeddings_batch([text])
    return embeddings[0] if embeddings else []

async def embed_and_store_report(session_id: str, user_id: str, full_report: dict, report_text: str):
    """Chunk the generated report and store embeddings in Supabase."""
    sb = get_supabase()
    if not sb:
        print("No Supabase client available, skipping RAG storage.")
        return

    # Delete existing chunks for this session just in case of re-runs
    try:
        sb.table("document_chunks").delete().eq("session_id", session_id).execute()
    except Exception as e:
        print(f"Warning: RAG delete failed (did you run the SQL script?): {e}")

    chunks = []
    
    # 1. Chunk the actual LLM generated text by double newlines
    paragraphs = [p.strip() for p in report_text.split("\n\n") if len(p.strip()) > 50]
    chunks.extend(paragraphs)
    
    # 2. Add specific raw data points as structured chunks so RAG doesn't hallucinate missing facts
    if "disease_risk" in full_report:
        for cond in full_report["disease_risk"].get("conditions", []):
            if cond.get("status") == "computed":
                chunks.append(f"Disease Risk - {cond.get('label')}: {cond.get('risk_label')} (Percentile: {cond.get('percentile')}%). {cond.get('message', '')}")
                
    if "pharmacogenomics" in full_report:
        for gene in full_report["pharmacogenomics"].get("genes", []):
            chunks.append(f"Pharmacogenomics - {gene.get('gene')}: {gene.get('status_label')}. Affected drugs: {', '.join(gene.get('affected_drugs', []))}")
            
    if "nutrition_traits" in full_report:
        for trait in full_report["nutrition_traits"].get("traits", []):
             if trait.get("status") != "not_tested":
                 chunks.append(f"Trait - {trait.get('name')}: {trait.get('label')}. Details: {trait.get('detail')}")

    print(f"Storing {len(chunks)} RAG chunks for session {session_id}...")
    
    if not chunks:
        return
        
    embeddings = await get_embeddings_batch(chunks)
    
    if embeddings and len(embeddings) == len(chunks):
        rows_to_insert = []
        for chunk, embedding in zip(chunks, embeddings):
            rows_to_insert.append({
                "session_id": session_id,
                "user_id": user_id,
                "content": chunk,
                "embedding": embedding
            })
            
        try:
            sb.table("document_chunks").insert(rows_to_insert).execute()
        except Exception as e:
            print(f"Warning: RAG bulk insert failed: {e}")
    else:
        print("Warning: Failed to generate embeddings for chunks.")

async def rag_search(session_id: str, query: str) -> str:
    """Find relevant chunks for a user query."""
    sb = get_supabase()
    if not sb:
        return ""
        
    query_embedding = await get_embedding(query)
    if not query_embedding:
        return ""
        
    try:
        result = sb.rpc(
            'match_chunks',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.5,
                'match_count': 5,
                'p_session_id': session_id
            }
        ).execute()
        
        if result.data:
            # Combine the matched chunks into a single context string
            return "\n\n".join([row['content'] for row in result.data])
    except Exception as e:
        print(f"RAG search error (ensure match_chunks RPC exists): {e}")
        
    return ""
