-- ============================================================
-- G-Nome Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('dna-files',  'dna-files',  false, 52428800,  ARRAY['text/plain', 'application/zip', 'application/octet-stream']),
  ('reports',    'reports',    false, 10485760,  ARRAY['application/pdf']),
  ('scan-images','scan-images',false, 10485760,  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filename        TEXT,
  dna_source      TEXT,
  snp_count       INTEGER,
  dna_file_path   TEXT,
  ancestry_group  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  error_message   TEXT
);

CREATE TABLE IF NOT EXISTS public.reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pgx             JSONB,
  disease_risk    JSONB,
  carrier_status  JSONB,
  traits          JSONB,
  narrative       TEXT,
  pdf_path        TEXT,
  pdf_generated   BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.scan_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scan_type       TEXT NOT NULL CHECK (scan_type IN ('skin', 'selfie')),
  image_path      TEXT,
  urgency         TEXT,
  fused_score     FLOAT,
  p_melanoma_raw  FLOAT,
  mc1r_multiplier FLOAT,
  all_class_probs JSONB,
  detected        JSONB,
  concordance     TEXT,
  disclaimer      TEXT
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- Sessions
CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE USING (auth.uid() = user_id);

-- Reports
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports"
  ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scan results
CREATE POLICY "Users can view own scans"
  ON public.scan_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scans"
  ON public.scan_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

CREATE POLICY "Users can upload own DNA files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dna-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own DNA files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dna-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own reports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own reports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own scan images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own scan images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_session_id  ON public.reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id     ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_session_id    ON public.scan_results(session_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id       ON public.scan_results(user_id);

-- ============================================================
-- SERVICE ROLE BYPASS (so backend with service key can write)
-- ============================================================

CREATE POLICY "Service role full access sessions"
  ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access reports"
  ON public.reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access scans"
  ON public.scan_results FOR ALL USING (true) WITH CHECK (true);
