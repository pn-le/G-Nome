# G-Nome — Genomic Risk Assessment Platform

> **AIxBio Hackathon at Bayer** | Equity-aware polygenic risk scoring with culturally competent health recommendations

## Overview

G-Nome is a genomic risk assessment platform that combines:

1. **Elastic Net ML Risk Engine** — Predicts disease risk probabilities (CAD, T2D, Alzheimer's) from 23andMe SNP data using ElasticNet logistic regression with Pan-UKBB ancestry weighting
2. **Culturally Competent PGx Advisor** — LLM-powered (Llama 3.3 70B) dietary and lifestyle recommendations tailored to the user's ancestry, replacing generic Western standards with culturally specific interventions
3. **Equity Badge UI** — React Native component that transparently communicates genomic data confidence based on GWAS representation of the user's ancestry

## Quick Start

### Backend (ML + API)

```bash
cd backend
pip install -r requirements.txt

# Generate synthetic training data (500 samples)
python -m ml.generate_synthetic

# Train ElasticNet models (CAD, T2D, Alzheimer's)
python -m ml.train_model

# Start the FastAPI server
uvicorn inference.risk_engine:app --host 0.0.0.0 --port 8000

# Run tests
pytest tests/ -v
```

### API Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/health` | Health check |
| `POST` | `/predict-risk` | Run disease risk inference |
| `GET` | `/model-info` | Model metadata & feature importance |

### Prediction Request

```json
{
  "snps": {
    "rs1333049": "CT",
    "rs429358": "CC",
    "rs7903146": "CT"
  },
  "ancestry_code": 2
}
```

### Prediction Response

```json
{
  "results": [
    {
      "disease": "Coronary Artery Disease",
      "risk_score": 0.67,
      "top_driving_snps": ["rs1333049", "rs10757278"]
    }
  ],
  "ancestry_code": 2,
  "ancestry_label": "CSA",
  "ancestry_display": "Central/South Asian",
  "confidence_score": 0.4,
  "inference_time_ms": 1.23
}
```

## Architecture

```
backend/
├── ml/
│   ├── snp_config.py           # SNP definitions, ancestry mappings
│   ├── generate_synthetic.py   # Synthetic data generator (HWE-based)
│   ├── train_model.py          # ElasticNet training with GridSearchCV
│   └── models.joblib           # Serialized trained models
├── inference/
│   └── risk_engine.py          # FastAPI POST /predict-risk endpoint
├── prompts/
│   └── pgx_system_prompt.md    # Llama 3.3 70B system prompt
└── tests/
    ├── mock_data.py            # Mock SNP dictionaries (6 ancestry groups)
    ├── test_risk_engine.py     # ML + API integration tests
    └── test_prompt.py          # Prompt validation tests

mobile/
└── components/
    └── EquityBadge.tsx         # React Native confidence badge
```

## Disease SNP Panel

| Disease | rsIDs | Top Gene/Locus |
|:---|:---|:---|
| **CAD** | rs1333049, rs4977574, rs10757278, rs6725887, rs9818870 | 9p21.3 / CDKN2A-B |
| **T2D** | rs7903146, rs1801282, rs5219, rs13266634, rs10811661 | TCF7L2, PPARG, KCNJ11 |
| **Alzheimer's** | rs429358, rs7412, rs11136000, rs3851179, rs744373 | APOE, CLU, PICALM, BIN1 |

## Pan-UKBB Ancestry Groups

| Code | Label | GWAS Weight | Confidence Tier |
|:---|:---|:---|:---|
| 0 | EUR (European) | 1.00 | 🟢 High |
| 1 | AFR (African) | 0.30 | 🔴 Low |
| 2 | CSA (Central/South Asian) | 0.40 | 🟡 Moderate |
| 3 | EAS (East Asian) | 0.50 | 🟡 Moderate |
| 4 | MID (Middle Eastern) | 0.25 | 🔴 Low |
| 5 | AMR (Admixed American) | 0.35 | 🔴 Low |

## License

See [LICENSE](LICENSE) for details.