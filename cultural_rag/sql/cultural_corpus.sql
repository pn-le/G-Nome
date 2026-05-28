-- ============================================================
-- Cultural Nutrition Corpus — pgvector table for RAG retrieval
-- ============================================================
-- Run this in the Supabase SQL Editor AFTER confirming the
-- embedding dimension via test_embedding_dim.py.
--
-- Replace EMBEDDING_DIM with the actual number (e.g., 4096).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- The corpus table
CREATE TABLE IF NOT EXISTS public.cultural_nutrition_corpus (
    id              TEXT PRIMARY KEY,
    culture         TEXT NOT NULL,
    condition       TEXT NOT NULL,
    content         TEXT NOT NULL,
    evidence_source TEXT NOT NULL,
    embedding       vector(4096),  -- UPDATE THIS after running test_embedding_dim.py
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index on culture for filtered retrieval
CREATE INDEX IF NOT EXISTS idx_corpus_culture
    ON public.cultural_nutrition_corpus(culture);

-- No vector index needed for hackathon (~100 rows → exact scan is instant)
-- Also: pgvector indexes cap at 2000 dims, our embeddings may exceed that

-- ============================================================
-- Match function for RAG retrieval
-- ============================================================

CREATE OR REPLACE FUNCTION match_cultural_docs(
    query_embedding vector(4096),  -- UPDATE THIS to match the table
    filter_culture  TEXT DEFAULT NULL,
    match_count     INT DEFAULT 5
)
RETURNS TABLE (
    id              TEXT,
    culture         TEXT,
    condition       TEXT,
    content         TEXT,
    evidence_source TEXT,
    similarity      FLOAT
)
AS $$
    SELECT
        c.id,
        c.culture,
        c.condition,
        c.content,
        c.evidence_source,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.cultural_nutrition_corpus c
    WHERE (filter_culture IS NULL OR c.culture = filter_culture)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- RLS — allow service role full access
-- ============================================================

ALTER TABLE public.cultural_nutrition_corpus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access corpus"
    ON public.cultural_nutrition_corpus
    FOR ALL USING (true) WITH CHECK (true);

-- Public read access (corpus is not user-specific)
CREATE POLICY "Public read corpus"
    ON public.cultural_nutrition_corpus
    FOR SELECT USING (true);
