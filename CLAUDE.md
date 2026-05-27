# G-Nome — Genomic Passport App

## What we are building

G-Nome is a **mobile app** (iOS + Android via React Native / Expo) that turns a 23andMe or AncestryDNA raw data file into a personalized health passport. The user uploads their DNA file, and the app produces a structured report covering drug safety, disease risks, carrier status, and nutrition — all adjusted for their actual ancestry.

**The core differentiator:** 78–80% of genetic risk algorithms are built on European data. G-Nome is the first consumer genomic product to explicitly correct for this, showing users which population weights their risk scores are based on and adjusting the calculations accordingly.

**This is a hackathon project.** We have 24 hours. Build fast, prioritize the demo, ship a working MVP.

---

## Tech stack

### Mobile (frontend)
- **React Native + Expo** — cross-platform iOS/Android
- `expo-camera` — image capture for skin lesion scanner and selfie check
- `expo-document-picker` — 23andMe / Ancestry file upload
- `react-native-paper` — UI components
- `victory-native` — charts and risk score meters

### Backend
- **Python + FastAPI** — all genomics computation and ML inference runs server-side
- `uvicorn` — ASGI server
- `snps` — parses 23andMe (.txt) and AncestryDNA (.csv) raw data files
- `pandas` + `numpy` — SNP lookup, PRS calculation
- `transformers` (HuggingFace) — EfficientNet-B4 for skin lesion CV
- `mediapipe` — face mesh for selfie phenotype check
- `openai` SDK pointed at Nebius API — LLM report generation (Llama 3.3 70B)
- `weasyprint` — PDF export

### LLM
- **Nebius API** — $100 hackathon credit, OpenAI-compatible
- Base URL: `https://api.studio.nebius.com/v1/`
- Model: `meta-llama/Llama-3.3-70B-Instruct`
- Use the `openai` Python SDK, just swap the base_url and api_key

---

## Project structure

```
g-nome/
├── CLAUDE.md                  # this file
├── mobile/                    # Expo React Native app
│   ├── app/
│   │   ├── index.tsx          # upload screen
│   │   ├── graph.tsx          # knowledge graph dashboard
│   │   ├── report/
│   │   │   ├── drugs.tsx      # pharmacogenomics tab
│   │   │   ├── risk.tsx       # disease risk tab
│   │   │   ├── carrier.tsx    # carrier status tab
│   │   │   ├── nutrition.tsx  # nutrition & traits tab
│   │   │   └── scan.tsx       # skin scan + selfie tab
│   │   └── _layout.tsx
│   ├── components/
│   │   ├── RiskMeter.tsx      # circular risk score meter
│   │   ├── EquityBadge.tsx    # ancestry transparency badge
│   │   ├── NodeGraph.tsx      # Obsidian-style knowledge graph
│   │   ├── DrugFlag.tsx       # red/amber/green drug card
│   │   └── SectionCard.tsx    # generic report section card
│   ├── app.json
│   └── package.json
├── backend/
│   ├── main.py                # FastAPI app, all routes
│   ├── parser.py              # snps file parsing
│   ├── pgx.py                 # pharmacogenomics engine
│   ├── prs.py                 # polygenic risk score calculation
│   ├── carrier.py             # carrier status lookup
│   ├── traits.py              # nutrition + trait SNPs
│   ├── cv_skin.py             # EfficientNet skin lesion inference
│   ├── cv_selfie.py           # MediaPipe selfie phenotype
│   ├── report.py              # Nebius LLM report generation
│   ├── pdf.py                 # weasyprint PDF export
│   ├── data/                  # pre-downloaded reference data (see below)
│   │   ├── cpic_alleles.json
│   │   ├── pharmgkb_variants.tsv
│   │   ├── clinvar_filtered.tsv
│   │   └── pgs_scores/        # PGS Catalog scoring files
│   └── requirements.txt
└── README.md
```

---

## Features to build (priority order)

### 1. DNA file upload and parsing (do this first — everything depends on it)
- Accept 23andMe .txt or AncestryDNA .csv via file upload
- Use `snps` library: `from snps import SNPs; s = SNPs("uploaded_file.txt")`
- Output: DataFrame with columns [rsid, chrom, pos, genotype]
- Expose as POST `/api/parse` → returns session token + SNP summary

### 2. Pharmacogenomics engine
- Look up these genes in the parsed SNPs: CYP2C9, CYP2C19, CYP1A2, SLCO1B1, DPYD, TPMT
- Determine metabolizer status: poor / intermediate / normal / rapid / ultra-rapid
- Cross-reference against CPIC allele definitions (pre-loaded from `data/cpic_alleles.json`)
- Flag affected drugs with severity: HIGH (avoid) / MODERATE (adjust dose) / LOW (monitor)
- Return safe drug alternatives for each flag
- Key drugs to flag: clopidogrel (CYP2C19), warfarin (CYP2C9), statins (SLCO1B1), SSRIs (CYP2C19), codeine (CYP2D6 — flag as limited data)
- NOTE: CYP2D6 cannot be reliably called from SNP arrays — show partial data with clear limitation warning

### 3. Disease risk scores (ancestry-adjusted)
- Calculate PRS for: coronary artery disease, type 2 diabetes, Alzheimer's disease
- Load PGS Catalog scoring files from `data/pgs_scores/`
  - CAD: PGS000018
  - T2D: PGS000036
  - Alzheimer's: PGS000334
- PRS formula: `score = sum(effect_allele_dosage * effect_weight)` for all SNPs in scoring file
- Apply ancestry adjustment using Pan-UKBB stratified weights
- Return: raw score, percentile vs. population, ancestry breakdown used, confidence flag
- Equity transparency: always show which ancestry weights were applied

### 4. Carrier status
- Look up pathogenic variants in ClinVar data (`data/clinvar_filtered.tsv`)
- Conditions: cystic fibrosis (CFTR), sickle cell (HBB rs334), Tay-Sachs (HEXA), beta-thalassemia (HBB), Gaucher (GBA)
- Return: carrier detected / not detected (NEVER say "not a carrier" — say "variant not found in tested set")
- Always show limitation disclaimer for each result

### 5. Nutrition and trait SNPs
- Hardcode these lookups (no external API needed):
  - Lactose intolerance: MCM6 rs4988235 (CC = intolerant, CT/TT = tolerant)
  - Alcohol flush: ALDH2 rs671 (AA = flush, AG = mild, GG = no flush)
  - Caffeine sensitivity: CYP1A2 rs762551 (AA = fast, AC/CC = slow)
  - Vitamin D: GC rs2282679 (TT = reduced absorption)
  - MTHFR: rs1801133 (TT = reduced folate processing)
  - Celiac risk: HLA region — rs2395182, rs7775228
- Return plain-language interpretation for each

### 6. LLM report generation
- After all modules complete, pass structured JSON to Nebius Llama 70B
- Generate plain-language section text for each module
- Prompt template: see `backend/report.py`
- Always append: "This is health guidance for informational purposes only, not medical advice."

### 7. Selfie phenotype check (CV module 1)
- Parse HIrisPlex-S SNPs from the uploaded file:
  - Eye color: OCA2 rs1800407, HERC2 rs12913832, SLC24A4 rs12896399
  - Hair color: MC1R rs1805007, rs1805008, ASIP rs1015362
  - Skin tone: SLC24A5 rs1426654, SLC45A2 rs16891982
- Predict: eye color (blue/green/brown/hazel), hair color (black/brown/blonde/red), skin tone (Fitzpatrick I–VI)
- User takes selfie → send to `/api/cv/selfie`
- Use MediaPipe Face Mesh server-side: sample iris pixels (eye color), hair region (hair color), cheek region (skin tone)
- Return: predicted vs. actual + match confidence + equity note if non-European ancestry detected

### 8. Skin lesion scanner (CV module 2)
- User photographs a mole → send image to `/api/cv/skin`
- Load EfficientNet-B4 model trained on HAM10000 from HuggingFace
- Run inference: return probability for each of 7 classes (MEL, NV, BCC, AKIEC, BKL, DF, VASC)
- Look up MC1R genotype from the parsed SNP session:
  - rs1805007 or rs1805008 present → genetic_multiplier = 2.1
  - Neither present → genetic_multiplier = 1.0
- Fused risk: `fused_score = p_melanoma * (1 + genetic_multiplier - 1)`  (normalize to 0–100)
- Urgency tiers:
  - 0–30: Low — routine monitoring
  - 30–55: Moderate — discuss with GP
  - 55–75: High — see dermatologist within 4 weeks
  - 75–100: Urgent — seek review within 1 week
- Always show disclaimer: not a clinical dermoscopy assessment

---

## API routes

```
POST /api/parse              # upload DNA file → returns session_id + SNP count
POST /api/report             # session_id → runs all modules → returns full report JSON
POST /api/cv/skin            # image + session_id → returns lesion classification + fused risk
POST /api/cv/selfie          # image + session_id → returns phenotype prediction + match score
GET  /api/pdf/{session_id}   # returns downloadable PDF passport
GET  /api/health             # health check
```

---

## Data sources (pre-download before coding starts)

All reference data should be downloaded locally into `backend/data/` before the hackathon coding begins. Do not rely on live API calls during the demo — they will fail.

| File | Source | What it provides |
|------|---------|-----------------|
| `cpic_alleles.json` | cpicpgx.org/api/v1/allele | Star allele definitions + drug recommendations |
| `pharmgkb_variants.tsv` | clinpgx.org downloads | 11,000+ variant-drug-condition pairs |
| `clinvar_filtered.tsv` | NCBI FTP clinvar/tab_delimited | Pathogenic variants for carrier status |
| `pgs_scores/PGS000018.txt` | pgscatalog.org/score/PGS000018 | CAD polygenic score weights |
| `pgs_scores/PGS000036.txt` | pgscatalog.org/score/PGS000036 | T2D polygenic score weights |
| `pgs_scores/PGS000334.txt` | pgscatalog.org/score/PGS000334 | Alzheimer's polygenic score weights |

To download PGS scoring files:
```bash
pip install pgscatalog-utils
pgscatalog-utils download -i PGS000018 PGS000036 PGS000334 -o backend/data/pgs_scores/
```

---

## Equity / ancestry transparency

This is the core differentiator — do not skip it.

Every disease risk score must include:
1. Which ancestry group weights were used (e.g. "60% European, 40% East Asian")
2. A confidence flag if data is sparse for the user's ancestry
3. A plain-language note: "Your risk score has been adjusted based on your ancestry composition"

The user's ancestry composition is available in the 23andMe file (ancestry_composition field) — parse it alongside the SNPs.

For the selfie check: if the phenotype prediction accuracy is lower for non-European ancestry, show: "Phenotype prediction models were primarily trained on European populations — this affects accuracy for your ancestry group. This is the same bias G-Nome corrects in your clinical risk scores."

---

## UI design direction

- **Style:** Clean, light background (#F7F6F3 warm off-white), not dark
- **Home screen:** Obsidian-inspired knowledge graph — genes, drugs, and diseases as connected colored nodes. Tap a node to expand detail panel.
- **Node color coding:**
  - Purple — gene nodes
  - Red/coral — high risk drugs or elevated disease risk
  - Amber — watch / moderate risk
  - Teal/green — clear / low risk
  - Pink — CV scan modules
  - Dark navy — center "You" node
- **Report tabs:** Drugs · Disease Risk · Carrier Status · Nutrition · Skin Scan
- **Equity badge:** Small persistent badge on every risk score showing ancestry weights used
- **Tone:** Plain language first, technical detail available on tap/expand
- **Disclaimer:** Visible on every screen that shows clinical data — "Health guidance only. Not medical advice."

---

## Disclaimers (non-negotiable)

These must appear in the UI — do not remove them:

- Onboarding: full disclaimer before any data is uploaded
- Every drug flag: "Discuss with your prescriber before making any medication changes"
- Every disease risk: "This is not a diagnosis. Risk scores indicate likelihood, not certainty."
- Carrier status: "We did not detect the specific variants we tested for. This does not mean you are not a carrier."
- Skin scan: "Not a dermatological assessment. Consult a clinician for any skin concern."
- CYP2D6: "CYP2D6 cannot be reliably determined from SNP array data. Results shown are partial."

---

## Environment variables

```bash
NEBIUS_API_KEY=your_key_here
NEBIUS_BASE_URL=https://api.studio.nebius.com/v1/
NEBIUS_MODEL=meta-llama/Llama-3.3-70B-Instruct
```

---

## MVP build order (24 hours)

1. FastAPI skeleton + `/api/health` endpoint
2. `parser.py` — snps file upload and parse → session store
3. `pgx.py` — CYP gene lookup → drug flags from CPIC JSON
4. `prs.py` — load PGS files → compute weighted PRS for 3 diseases
5. `report.py` — Nebius LLM call → section text generation
6. Expo mobile: upload screen → call backend → display report tabs
7. `cv_selfie.py` — HIrisPlex SNP lookup + MediaPipe face analysis
8. `cv_skin.py` — EfficientNet inference + MC1R fusion
9. Knowledge graph screen (NodeGraph component)
10. Polish: equity badges, disclaimers, PDF export

---

## What not to build (scope cuts for 24h)

- Do not build user accounts or auth — sessions are ephemeral
- Do not store genomic data persistently — process in memory, discard after session
- Do not build CYP2D6 full calling — flag as limited and move on
- Do not build the retinal scan module — not enough time
- Do not build SMA carrier status — SMN1 CNV is not detectable from SNP arrays
- Do not build a web version — mobile only for the demo

---

## Testing

Use this public 23andMe sample file for end-to-end testing:
- Search GitHub for "23andMe sample raw data" or use any publicly shared anonymized file
- The `snps` library includes a test fixture: `from snps.utils import create_snp_file`

Run backend tests: `pytest backend/tests/`
Run mobile: `npx expo start` then scan QR with Expo Go app

---

## Hackathon context

- Event: AIxBio Hackathon at Bayer (Boston Tech Week)
- Dates: May 27–28, 2026
- Time limit: 24 hours
- Demo format: Live app demo + pitch presentation
- Judges care about: novelty, technical depth, equity angle, real-world impact
- Lead with the equity angle in the pitch — it is the differentiator
- Demo flow: selfie check → drug flag → disease risk with ancestry breakdown → skin scan
