"""Retrieval-Augmented Generation (RAG) utilities using Nebius Embeddings & Supabase pgvector."""

import os
from openai import AsyncOpenAI
from supabase_client import get_supabase

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

async def get_embedding(text: str) -> list[float]:
    """Generate a 4096-dimensional embedding using Qwen3-Embedding-8B."""
    client = _get_client()
    if not client:
        return []
    
    # Replace newlines as recommended for embeddings
    text = text.replace("\n", " ")
    
    try:
        response = await client.embeddings.create(
            model="Qwen/Qwen3-Embedding-8B",
            input=[text]
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return []

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
    
    for chunk in chunks:
        embedding = await get_embedding(chunk)
        if embedding:
            try:
                sb.table("document_chunks").insert({
                    "session_id": session_id,
                    "user_id": user_id,
                    "content": chunk,
                    "embedding": embedding
                }).execute()
            except Exception as e:
                print(f"Warning: RAG insert failed: {e}")

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
