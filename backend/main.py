import os
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from parser import parse_dna_file
from pgx import run_pharmacogenomics
from prs import compute_risk_scores
from carrier import check_carrier_status
from traits import analyze_traits
from report import generate_report
from pdf import render_pdf


# In-memory session store: session_id -> { snps: DataFrame, ancestry: dict, results: dict }
sessions: dict[str, dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    sessions.clear()


app = FastAPI(title="G-Nome API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "sessions": len(sessions)}


@app.post("/api/parse")
async def parse(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    raw = await file.read()
    try:
        result = parse_dna_file(raw, file.filename)
    except Exception as e:
        raise HTTPException(422, f"Could not parse DNA file: {e}")

    session_id = uuid.uuid4().hex[:12]
    sessions[session_id] = {
        "snps": result["snps"],
        "ancestry": result.get("ancestry", {}),
        "source": result["source"],
    }

    return {
        "session_id": session_id,
        "source": result["source"],
        "snp_count": len(result["snps"]),
        "chromosomes": result["snps"]["chrom"].nunique(),
        "ancestry": result.get("ancestry", {}),
    }


@app.post("/api/report")
async def report(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    snps = session["snps"]
    ancestry = session.get("ancestry", {})

    pgx = run_pharmacogenomics(snps)
    risk = compute_risk_scores(snps, ancestry)
    carriers = check_carrier_status(snps)
    nutrition = analyze_traits(snps)

    modules = {
        "pharmacogenomics": pgx,
        "disease_risk": risk,
        "carrier_status": carriers,
        "nutrition_traits": nutrition,
    }

    llm_report = await generate_report(modules, ancestry)

    full_report = {**modules, "report_text": llm_report}
    session["results"] = full_report

    return full_report


@app.post("/api/cv/selfie")
async def cv_selfie(session_id: str, image: UploadFile = File(...)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    from cv_selfie import analyze_selfie

    img_bytes = await image.read()
    result = analyze_selfie(img_bytes, session["snps"], session.get("ancestry", {}))
    return result


@app.post("/api/cv/skin")
async def cv_skin(session_id: str, image: UploadFile = File(...)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    from cv_skin import analyze_skin_lesion

    img_bytes = await image.read()
    result = analyze_skin_lesion(img_bytes, session["snps"])
    return result


@app.get("/api/pdf/{session_id}")
async def get_pdf(session_id: str):
    session = sessions.get(session_id)
    if not session or "results" not in session:
        raise HTTPException(404, "No report found — run /api/report first")

    pdf_bytes = render_pdf(session["results"], session.get("ancestry", {}))
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=gnome_passport_{session_id}.pdf"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
