"""
End-to-end test: POST /api/cultural-recommendations
against the running uvicorn on localhost:8000.
"""
import sys, os, json, asyncio, time

# Ensure project root on path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import httpx

API = os.environ.get("API_BASE", "http://localhost:8000")

# Minimal payload modeled after schemas.SAMPLE_PAYLOAD
PAYLOAD = {
    "parse": {
        "source": "AncestryDNA",
        "ancestry": {},
        "snp_count": 673826,
    },
    "report": {
        "report_text": {
            "full_text": (
                "## Pharmacogenomics Summary\n"
                "CYP2C19: Normal Metabolizer. CYP2D6: Undetermined. "
                "No actionable drug flags.\n\n"
                "## Nutrition & Traits\n"
                "Slow caffeine metabolizer. Reduced vitamin D absorption. "
                "High celiac risk (HLA-DQ2.5)."
            ),
        },
        "disease_risk": {
            "conditions": [
                {
                    "status": "computed",
                    "condition": "Type 2 Diabetes (ML Enhanced)",
                    "raw_score": 0.1359,
                    "risk_tier": "moderate",
                    "percentile": 45.0,
                    "risk_label": "Moderate Risk",
                    "description": "Elevated T2D risk from ML model.",
                },
                {
                    "status": "computed",
                    "condition": "Coronary Artery Disease (ML Enhanced)",
                    "raw_score": 0.0951,
                    "risk_tier": "low",
                    "percentile": 9.5,
                    "risk_label": "Below Average Risk",
                    "description": "Low CAD risk.",
                },
            ],
        },
        "carrier_status": {
            "results": [
                {
                    "gene": "HBB",
                    "status": "pathogenic_detected",
                    "condition": "Beta-Thalassemia",
                    "detail": "Carrier detected.",
                },
            ],
        },
    },
}

REQUEST_BODY = {
    "payload": PAYLOAD,
    "culture": "Vietnamese",
    "flagged_drugs": ["codeine", "metformin"],
    "metabolizer_status": {"CYP2C19": "Normal Metabolizer"},
}


async def main():
    print(f"E2E test → POST {API}/api/cultural-recommendations")
    print(f"  culture = Vietnamese")
    print(f"  conditions = T2D (moderate), CAD (low)")
    print(f"  flagged_drugs = codeine, metformin")
    print()

    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{API}/api/cultural-recommendations",
            json=REQUEST_BODY,
        )

    elapsed = time.perf_counter() - t0
    print(f"  Status: {resp.status_code}  ({elapsed:.1f}s)")

    if resp.status_code != 200:
        print(f"  ERROR body: {resp.text[:500]}")
        sys.exit(1)

    data = resp.json()

    # Pretty-print
    print()
    print("=" * 60)
    print("RESPONSE")
    print("=" * 60)
    print(json.dumps(data, indent=2, ensure_ascii=False))

    # Sanity checks
    ok = True
    if not data.get("cultural_profile"):
        print("\n[FAIL] Missing cultural_profile"); ok = False
    if not data.get("dietary_recommendations"):
        print("\n[FAIL] No dietary_recommendations"); ok = False
    else:
        for dr in data["dietary_recommendations"]:
            if not dr.get("evidence_source"):
                print(f"\n[WARN] No evidence_source for condition={dr.get('condition')}")
    if not data.get("disclaimer"):
        print("\n[FAIL] Missing disclaimer"); ok = False

    print()
    if ok:
        print("[PASS] Cultural RAG endpoint returned valid CulturalRecommendations ✓")
    else:
        print("[FAIL] Some checks failed — see above")

    return ok


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
