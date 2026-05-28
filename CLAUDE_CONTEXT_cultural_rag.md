# G-Nome — Cultural Pharmacogenomics RAG Module

> **Claude Code handoff.** This is the complete spec for ONE module of a larger hackathon project. Read it fully before writing code. It defines what this module is, where it sits, the exact data contracts, the architecture decisions already made (and why), the model choices, and the build order. Do not re-litigate decisions marked **LOCKED**. Flag anything that conflicts with the rest of the codebase.
>
> **Companion files (in repo):** `supabase_cultural_corpus.sql` (pgvector schema), `schemas.py` (contracts + adapter + mock fixture).

---

## 0. TL;DR for the agent

You are building the **culturally competent dietary/lifestyle recommendation module** for G-Nome, a genomic health-passport app. This module is a **RAG pipeline**: it takes a structured genomic profile (produced upstream by teammates), retrieves evidence-graded cultural-nutrition documents from a Supabase pgvector store, and uses an LLM to generate dietary + drug-food-interaction guidance tailored to the user's cultural background, as schema-valid JSON.

- **It does NOT parse DNA.** That happens upstream.
- **Its RAG corpus is cultural-nutrition knowledge, NOT DNA files.**
- **Embeddings + generation both run on Nebius Token Factory** (OpenAI-compatible API; $100 credit **per person**).
- **Vector store is Supabase pgvector** (the team's existing DB).
- **Time budget: 24-hour hackathon.** Optimize for a working, demoable, defensible slice — not completeness.

---

## 1. Project context

**Product:** G-Nome — a React Native (Expo) iOS/Android app that turns a 23andMe / AncestryDNA raw `.txt` file into a personalized health passport: pharmacogenomics (drug safety/dose), disease risk scores, carrier status, nutrition/traits, plus two computer-vision modules (skin-lesion scanner, selfie phenotype check).

**Event:** Bayer × AIxBio Hackathon, Boston Tech Week. May 27–28, 2026. 24 hours. **$100 Nebius Token Factory credits per person.**

**Core differentiator (pitch spine):** Most genomic risk algorithms (~78–80%) are calibrated on European-ancestry data. G-Nome corrects for this with ancestry-adjusted scoring and culturally relevant guidance. **This module is the "culturally relevant guidance" half of that equity story** — it turns a diagnostic readout into actionable advice that respects how a person actually eats.

**Upstream risk-scoring note (context only):** the team's polygenic risk-scoring method is **Elastic Net** (L1+L2; suited to high-dim sparse SNP features). Not your module, but your output sits next to it in the report.

---

## 2. Where this module sits in the system

```
AncestryDNA / 23andMe raw .txt  (TAB-delimited SNP rows: rsid, chromosome, position, allele1, allele2)
            │
            ▼
[TEAMMATES — NOT YOU]
  snps library → SNP extraction
  CPIC / PharmGKB lookup → pharmacogenomics flags
  PGS Catalog + Pan-UKBB → Elastic Net ancestry-adjusted risk scores
  ancestry inference → ancestry composition %
            │
            ▼  (structured genomic profile — see §3 INPUT CONTRACT)
[YOU — Cultural RAG Module]
  1. resolve culture from ancestry (infer-then-confirm)
  2. build retrieval query from genomic profile
  3. Supabase pgvector retrieval over pre-built cultural-nutrition corpus
  4. Nebius Qwen3.5 synthesis → culturally tailored recommendations (schema-valid JSON)
            │
            ▼  (cultural recommendations JSON — see §3 OUTPUT CONTRACT)
[REPORT LAYER — teammate]
  renders into the 5-tab report + PDF passport
```

**Critical correction baked into this design:** the long DNA `.txt` file is the *upstream* input. You never touch it. You consume the **structured profile** produced from it. The `.txt` is NOT your RAG corpus.

---

## 3. Data contracts — see `schemas.py` (canonical source)

`schemas.py` is authoritative; this section summarizes it. **The single most important pre-build task is confirming the real INPUT shape with the genomic-pipeline owner.** Until then, the module runs against `MOCK_PAYLOAD`. All upstream-shape knowledge is isolated in one function, `adapt_upstream()` — when the real schema lands, you change ONLY that function.

### INPUT — canonical `GenomicProfile` (what the rest of the module depends on)

```json
{
  "ancestry": { "East Asian": 0.72, "European": 0.18, "South Asian": 0.10 },
  "inferred_culture": "East Asian",
  "culture_confirmed_by_user": false,
  "metabolic_risks": ["Type 2 Diabetes", "elevated LDL"],
  "flagged_drugs": ["clopidogrel", "simvastatin"],
  "metabolizer_status": { "CYP2C19": "poor_metabolizer", "CYP2C9": "normal" }
}
```

### OUTPUT — `CulturalRecommendations` (handed to the report/PDF layer)

```json
{
  "cultural_profile": "East Asian",
  "culture_confirmed_by_user": false,
  "dietary_recommendations": [
    {
      "condition": "Type 2 Diabetes risk",
      "advice": "Replace white rice with brown rice or shirataki noodles to lower glycemic load while keeping the staple familiar.",
      "culturally_relevant_foods": ["brown rice", "bitter melon", "tofu", "barley"],
      "foods_to_limit": ["white rice", "mochi", "sweetened soy milk"],
      "evidence_source": ["USDA fdcId:169704", "PMID:12345678"]
    }
  ],
  "drug_food_interactions": [
    {
      "drug": "simvastatin",
      "interaction": "Grapefruit inhibits CYP3A4, raising statin blood levels.",
      "cultural_note": "Pomelo — common in East Asian cuisine — has the same CYP3A4 effect as grapefruit.",
      "evidence_source": ["PMID:23456789"]
    }
  ],
  "cultural_note": "Recommendations adapt standard guidance to East Asian dietary staples; verify with a clinician.",
  "disclaimer": "Informational only. Not a medical device. Review with a qualified clinician before any health or medication decisions."
}
```

> **Every recommendation MUST carry a non-empty `evidence_source` traceable to a USDA `fdcId` or PubMed `PMID`.** This sourcing is a deliberate pitch strength — "every claim is traceable" beats the typical prompt-only hackathon LLM app. Do not generate advice the retrieved context can't support.

---

## 4. Architecture decisions — LOCKED

| Decision | Choice | Rationale |
|---|---|---|
| Vector store | **Supabase pgvector** (new table in the team's existing DB) | One shared DB across the team; no extra infra. See `supabase_cultural_corpus.sql`. |
| Vector index | **None for the hackathon** | Corpus is ~50–100 rows → exact sequential scan is instant. Also: pgvector indexes cap at 2000 dims and the embedding model emits more, so an index would force dim truncation. Skip it. |
| Embeddings | **`Qwen/Qwen3-Embedding-8B`** (Nebius) | Only embedding model on the platform; strong multilingual (your corpus has non-English food terms). Confirm output dim with a test call → set `vector(N)` in the SQL to match. |
| Generation | **`Qwen/Qwen3.5-397B-A17B`, instruct / NON-thinking mode** (Nebius) | Top-tier open-weight capability on the axis this task needs: documented JSON-schema structured-output support, strong multilingual, MoE (17B active) so credit-efficient and fast. Ecosystem-consistent with the Qwen embedder. Use `-fast` variant if demo latency bites. |
| Structured output | **Enforce `response_format` JSON schema (`CulturalRecommendations`) at the API level** + defensive parse | Don't rely on "respond in JSON" in the prompt alone. |
| Temperature | **0.3** for generation, **0.1** for the corpus verification pass | Low temp for clinical reliability. |
| Culture resolution | **Infer-then-confirm** | 23andMe ancestry % ≠ lived food culture. Infer top ancestry as default, surface a confirm/override to the user. Pitch moment: "we don't assume your culture from your DNA — we verify with you." |
| Cultures at MVP | East Asian, Southeast Asian, European, South Asian, African, Middle Eastern | 6 groups done well > all groups done badly. Extensible: "adding a culture = adding documents." |
| Corpus prep timing | **Pre-built before the clock starts** | Embedding/cleaning during build hours is wasted time. Corpus ships loaded. |

### Model facts the agent must NOT get wrong
- **Nebius Token Factory serves only open-weight models.** Claude Opus, Gemini, and OpenAI GPT are proprietary and are **NOT** on the platform; the $100 credit does not cover them. Do not reference them as options.
- **Thinking/reasoning-mode models cannot reliably do enforced structured output.** This pipeline requires schema-valid JSON, so use a **non-thinking instruct** model. Do NOT use `*-Thinking` variants or DeepSeek-V4-Pro Max mode for the structured-output call.
- Verify the live model list before relying on any string:
  ```bash
  curl https://api.tokenfactory.nebius.com/v1/models -H "Authorization: Bearer $NEBIUS_API_KEY"
  ```
- **Never hardcode or commit the API key.** Read from `NEBIUS_API_KEY` env / gitignored `.env`.

### Shared Nebius client
```python
from openai import OpenAI
import os
client = OpenAI(
    base_url="https://api.tokenfactory.nebius.com/v1/",
    api_key=os.environ["NEBIUS_API_KEY"],
)
EMBED_MODEL = "Qwen/Qwen3-Embedding-8B"
GEN_MODEL   = "Qwen/Qwen3.5-397B-A17B"   # instruct / non-thinking; "-fast" if latency bites
```

---

## 5. The corpus

**6 cultures.** Three programmatic sources + hand-curated fill. Each document keeps a traceable source ID.

| Source | Format | Access | Verification concern |
|---|---|---|---|
| USDA FoodData Central | JSON API | Free key at `api.nal.usda.gov`; use `dataType=["SR Legacy","Foundation"]` | Accurate but generic — confirm cultural food name maps to the correct USDA entry (manual spot-check ~10/culture). |
| WHO dietary guidelines (by region) | PDFs | Download | Authoritative but broad — extract only specific, actionable claims. |
| PubMed abstracts | XML/JSON (Entrez eutils) | Free | Noisy — **filter to `systematic review[pt] OR randomized controlled trial[pt]`**; keep PMID + URL. |
| Hand-curated cultural food guides | Plain text | Author yourself | Highest control; best for filling gaps and demo reliability. |

**Corpus row shape (matches the Supabase table):**
```json
{
  "id": "east_asian_t2d_001",
  "culture": "East Asian",
  "condition": "Type 2 Diabetes",
  "content": "Free-text chunk with the actual nutritional/clinical claim...",
  "evidence_source": "USDA fdcId:169704"   // or "PMID:12345678"
}
```

**Cultural food seed map (starting point — expand):**
- East Asian: brown rice, bitter melon, tofu, shirataki noodles, miso
- South Asian: dal lentils, roti, turmeric, fenugreek, ghee
- Southeast Asian: jasmine rice, fish sauce, tempeh, papaya, coconut milk
- African: plantain, egusi, fufu, jollof rice, palm oil
- Middle Eastern: bulgur wheat, hummus, za'atar, freekeh, tahini
- European: rye bread, olive oil, fermented dairy, legumes, oats

**Ingestion approach:**
- USDA: `GET https://api.nal.usda.gov/fdc/v1/foods/search` with `query`, `api_key`, `pageSize`, `dataType`. Extract Energy / Carb / Fat / Protein / Fiber / Sugars per food. Loop over `{culture: [foods]}`.
- PubMed: Entrez `esearch` (append `AND (systematic review[pt] OR randomized controlled trial[pt])`) → `efetch` (`rettype=abstract`, `retmode=xml`) → parse `ArticleTitle`, `AbstractText`, `PMID`, `PubDate/Year`. Respect rate limit (~0.5–1s sleeps). Skip records with no abstract.

---

## 6. Verification pipeline

Not clinical peer review in 24h. "Verified" = relevant, actionable, traceable, free of dangerous unsupported claims.

| Check | Mechanism |
|---|---|
| USDA food matched correctly | Manual spot-check ~10 foods/culture |
| PubMed = RCT/systematic review only | Enforced in the `esearch` query string |
| No dangerous clinical claims | LLM verification pass (Qwen3.5, temp 0.1) → JSON flags |
| Source traceability | Every row keeps `fdcId` or `PMID` |
| Contradictions | Surfaced in pitch as "evidence-graded corpus" |

LLM verification flags each candidate doc → `is_relevant`, `is_actionable`, `risk_level (low/medium/high)`, `cultural_specificity (specific/general)`, `flag (approve/revise/reject)`, `reason`. Keep `approve`; drop `reject`; eyeball `revise`.

---

## 7. Runtime pipeline (the actual module)

```
genomic_profile (INPUT json) ── adapt_upstream() ──► GenomicProfile
   │
   ├─ resolve_culture()            # top ancestry → default; honor culture_confirmed_by_user override
   ├─ build_query()                # f"{culture} diet for {risks} while on {drugs}"
   ├─ embed_query()                # Nebius Qwen3-Embedding-8B
   ├─ supabase.rpc("match_cultural_docs", {query_embedding, filter_culture, match_count:5})
   ├─ assemble_context()           # join retrieved .content + their evidence_source
   └─ generate()                   # Nebius Qwen3.5-397B-A17B, non-thinking, response_format=JSON schema, temp 0.3
   │
   ▼
CulturalRecommendations (OUTPUT json, pydantic-validated)
```

**Generation prompt must instruct:** name actual culturally familiar foods; use ONLY claims supported by the provided context; attach `evidence_source` to each item; never omit the disclaimer. Enforce the schema via `response_format`, AND still parse defensively (`try/except` around `json.loads`; strip ```` ```json ```` fences before parsing; on failure, one retry then a safe empty-with-disclaimer fallback).

**Corpus build is offline and ships loaded.** At runtime you never re-embed the corpus — you only embed the incoming query.

---

## 8. Suggested module layout

```
cultural_rag/
├── data/
│   ├── usda_corpus_raw.json
│   ├── pubmed_corpus_raw.json
│   ├── pubmed_corpus_verified.json
│   └── handcurated/                 # *.txt or *.json per culture
├── ingest/
│   ├── pull_usda.py
│   ├── pull_pubmed.py
│   ├── verify_docs.py
│   └── load_supabase.py             # embed each row + upsert into cultural_nutrition_corpus
├── runtime/
│   ├── nebius_client.py             # shared OpenAI-compatible client + model constants
│   ├── resolve_culture.py
│   ├── retrieve.py                  # embed query, supabase.rpc match_cultural_docs
│   └── generate.py                  # prompt + Qwen3.5 call (response_format) + defensive parse
├── api.py                           # FastAPI: POST /cultural-recommendations
├── schemas.py                       # contracts + adapter + mock fixture (ALREADY WRITTEN)
└── tests/
    └── test_contract.py             # validate I/O against schemas.py using MOCK_PAYLOAD
```

**FastAPI surface:** `POST /cultural-recommendations` accepts the upstream payload, runs `adapt_upstream()`, returns `CulturalRecommendations`. Stateless; instantiate the Supabase + Nebius clients once at startup.

---

## 9. Build order (your lane, within 24h)

1. **Pre-clock (tonight):** rotate/secure Nebius key in env; confirm embedding dim via one test call and set `vector(N)` in the SQL; run `supabase_cultural_corpus.sql`; obtain USDA key; pull corpus (USDA + PubMed); verify; hand-curate gaps; embed + load into Supabase; confirm INPUT shape with genomic-pipeline owner.
2. **0–2h:** scaffold module; wire `nebius_client.py`; smoke-test `match_cultural_docs` retrieval with `MOCK_PAYLOAD`.
3. **2–5h:** `resolve_culture` + `retrieve` + `generate` end-to-end on the mock; lock the OUTPUT JSON via `response_format`.
4. **5–7h:** FastAPI endpoint; integrate the real upstream profile once a teammate emits one; the only change is inside `adapt_upstream()`.
5. **7–9h:** harden — JSON parse failures/retry, empty retrieval, missing fields, unknown-culture fallback, the user-override path.
6. **Stretch:** richer drug-food interaction coverage; per-culture demo fixtures (`MOCK_PAYLOADS_BY_CULTURE`) for the live pitch.

---

## 10. Open dependencies / things to confirm

- [ ] **INPUT field names** confirmed with the genomic-pipeline owner; reflected in `adapt_upstream()`.
- [ ] **Embedding dimension** confirmed via test call; `vector(N)` in the SQL set to match (table column AND the RPC signature — two places).
- [ ] How the **report layer** wants the OUTPUT (keys OK? PDF need anything extra?).
- [ ] Where the **user-override** for culture lives in the app flow (mobile team renders the confirm prompt).
- [ ] Re-confirm `Qwen/Qwen3-Embedding-8B` and `Qwen/Qwen3.5-397B-A17B` against the live `/v1/models` list before relying on them.

---

## 11. Hard constraints / non-negotiables

- Informational tool, **not a medical device**. Every output carries the disclaimer. No definitive diagnoses or "stop taking X" directives.
- No recommendation without a retrievable `evidence_source`.
- Don't infer culture as fact — infer as default, confirm with user.
- Non-thinking instruct model only for the structured-output call. No proprietary models (not on platform).
- Never commit the Nebius key. Env / gitignored `.env` only.
