"""
Runtime RAG pipeline for the Cultural Nutrition module.

Exposes async helpers used by the FastAPI router (cultural_rag/api.py):
    - resolve_culture
    - retrieve
    - generate_recommendations

A shared AsyncOpenAI client is built here so the ingest scripts (which use
the sync client from cultural_rag.config) are untouched.
"""

from __future__ import annotations
import os
from openai import AsyncOpenAI

from cultural_rag.config import NEBIUS_API_KEY, NEBIUS_BASE_URL, EMBED_MODEL, GEN_MODEL

async_nebius_client: AsyncOpenAI | None = (
    AsyncOpenAI(base_url=NEBIUS_BASE_URL, api_key=NEBIUS_API_KEY)
    if NEBIUS_API_KEY else None
)

__all__ = ["async_nebius_client", "EMBED_MODEL", "GEN_MODEL"]
