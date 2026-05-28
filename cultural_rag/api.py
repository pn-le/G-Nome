"""
FastAPI router for the Cultural Nutrition RAG module.

Mount from backend/main.py:
    from cultural_rag.api import router as cultural_router
    app.include_router(cultural_router, prefix="/api")

Endpoint: POST /api/cultural-recommendations
"""

from __future__ import annotations
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cultural_rag.schemas import (
    CulturalRecommendations,
    adapt_upstream,
)
from cultural_rag.runtime.resolve_culture import resolve_culture
from cultural_rag.runtime.retrieve import retrieve
from cultural_rag.runtime.generate import generate_recommendations

router = APIRouter(tags=["cultural-rag"])


class CulturalRequest(BaseModel):
    """Request body: upstream report payload + user-selected culture."""
    payload: dict[str, Any] = Field(
        ...,
        description="Upstream genomic report payload — see schemas.SAMPLE_PAYLOAD.",
    )
    culture: str = Field(
        "",
        description="User-selected culture from dropdown. Empty falls back to ancestry inference.",
    )
    flagged_drugs: list[str] = Field(
        default_factory=list,
        description="Optional: drug names flagged by the pgx module.",
    )
    metabolizer_status: dict[str, str] = Field(
        default_factory=dict,
        description="Optional: metabolizer status by gene from the pgx module.",
    )


def _get_supabase():
    """Lazy-import Supabase client from the backend package."""
    try:
        from backend.supabase_client import get_supabase
        return get_supabase()
    except ImportError:
        try:
            from supabase_client import get_supabase  # fallback if running from backend/
            return get_supabase()
        except ImportError:
            return None


@router.post("/cultural-recommendations", response_model=CulturalRecommendations)
async def cultural_recommendations(req: CulturalRequest) -> CulturalRecommendations:
    """
    Run the cultural RAG pipeline:
        adapt upstream → resolve culture → embed query → Supabase retrieval →
        Qwen3 generation with schema-enforced JSON.
    """
    profile = adapt_upstream(req.payload, culture=req.culture)

    if req.flagged_drugs:
        profile.flagged_drugs = req.flagged_drugs
    if req.metabolizer_status:
        profile.metabolizer_status = req.metabolizer_status

    resolved = resolve_culture(profile)
    profile.culture = resolved

    sb = _get_supabase()
    if sb is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
        )

    docs = await retrieve(profile, culture=resolved, supabase=sb, k=5)
    recommendations = await generate_recommendations(profile, resolved, docs)
    return recommendations
