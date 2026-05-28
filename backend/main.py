import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from fastapi import FastAPI, File, Header, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from parser import parse_dna_file
from pgx import run_pharmacogenomics
from prs import compute_risk_scores
from carrier import check_carrier_status
from traits import analyze_traits
from report import generate_report
from pdf import render_pdf
from supabase_client import get_supabase

import sys
import os
# Ensure the parent directory is in sys.path so cultural_rag can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from cultural_rag.api import router as cultural_router


# Persistent session storage (local disk fallback)
SESSIONS_DIR = Path(__file__).parent / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)

# In-memory session store: session_id -> { snps: DataFrame, ancestry: dict, results: dict }
sessions: dict[str, dict[str, Any]] = {}


# -- Auth helper --

async def _get_user_id(authorization: str | None) -> str | None:
    """Extract user_id from Supabase JWT. Returns None if no auth configured."""
    sb = get_supabase()
    if not sb or not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    try:
        resp = sb.auth.get_user(token)
        return str(resp.user.id) if resp and resp.user else None
    except Exception:
        return None


# -- Local disk persistence --

def _save_session_disk(session_id: str, session: dict):
    path = SESSIONS_DIR / session_id
    path.mkdir(exist_ok=True)
    session["snps"].to_parquet(path / "snps.parquet", index=False)
    meta = {"ancestry": session.get("ancestry", {}), "sex": session.get("sex", "Unknown"), "source": session.get("source", "")}
    (path / "meta.json").write_text(json.dumps(meta))


def _load_sessions_disk():
    if not SESSIONS_DIR.exists():
        return
    for p in SESSIONS_DIR.iterdir():
        if not p.is_dir() or p.name.startswith("."):
            continue
        snps_path = p / "snps.parquet"
        meta_path = p / "meta.json"
        if snps_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text())
            sessions[p.name] = {
                "snps": pd.read_parquet(snps_path),
                "ancestry": meta.get("ancestry", {}),
                "sex": meta.get("sex", "Unknown"),
                "source": meta.get("source", ""),
            }


# -- Supabase persistence --

def _save_session_supabase(session_id: str, user_id: str, filename: str,
                           source: str, snp_count: int, ancestry: dict, raw_bytes: bytes):
    sb = get_supabase()
    if not sb:
        return

    # Upload raw DNA file to storage
    file_path = f"{user_id}/{session_id}/{filename}"
    try:
        sb.storage.from_("dna-files").upload(
            path=file_path, file=raw_bytes,
            file_options={"content-type": "text/plain"},
        )
    except Exception:
        pass  # file may already exist

    # Insert session row
    dominant = max(ancestry, key=ancestry.get) if ancestry else None
    sb.table("sessions").insert({
        "id": session_id,
        "user_id": user_id,
        "filename": filename,
        "dna_source": source,
        "snp_count": snp_count,
        "dna_file_path": file_path,
        "ancestry_group": dominant,
        "status": "pending",
    }).execute()


def _save_report_supabase(session_id: str, user_id: str, modules: dict, narrative):
    sb = get_supabase()
    if not sb:
        return

    sb.table("reports").insert({
        "session_id": session_id,
        "user_id": user_id,
        "pgx": modules.get("pharmacogenomics"),
        "disease_risk": modules.get("disease_risk"),
        "carrier_status": modules.get("carrier_status"),
        "traits": modules.get("nutrition_traits"),
        "narrative": json.dumps(narrative) if isinstance(narrative, dict) else narrative,
    }).execute()

    sb.table("sessions").update({"status": "complete"}).eq("id", session_id).execute()


def _save_scan_supabase(session_id: str, user_id: str, scan_type: str,
                        result: dict, img_bytes: bytes):
    sb = get_supabase()
    if not sb:
        return

    image_path = f"{user_id}/{session_id}/{scan_type}_{uuid.uuid4().hex[:8]}.jpg"
    try:
        sb.storage.from_("scan-images").upload(
            path=image_path, file=img_bytes,
            file_options={"content-type": "image/jpeg"},
        )
    except Exception:
        pass

    row = {
        "session_id": session_id,
        "user_id": user_id,
        "scan_type": scan_type,
        "image_path": image_path,
        "disclaimer": result.get("disclaimer", ""),
    }
    if scan_type == "skin":
        row.update({
            "urgency": result.get("urgency"),
            "fused_score": result.get("fused_risk_pct"),
            "p_melanoma_raw": result.get("melanoma_probability"),
            "mc1r_multiplier": result.get("genetic_multiplier"),
            "all_class_probs": {c["class"]: c["probability"] for c in result.get("classifications", [])},
        })
    elif scan_type == "selfie":
        row.update({
            "detected": result.get("observed"),
            "concordance": result.get("match_result"),
        })

    try:
        sb.table("scan_results").insert(row).execute()
    except Exception as e:
        print(f"Failed to save scan to Supabase (possibly invalid UUID): {e}")


# -- Lifespan --

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_sessions_disk()
    sb = get_supabase()
    print(f"Restored {len(sessions)} local session(s) | Supabase: {'connected' if sb else 'not configured'}")
    yield


app = FastAPI(title="G-Nome API", version="0.1.0", lifespan=lifespan)

app.include_router(cultural_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cultural_router, prefix="/api")


@app.get("/api/health")
def health():
    sb = get_supabase()
    return {"status": "ok", "sessions": len(sessions), "supabase": sb is not None}


@app.post("/api/parse")
async def parse(file: UploadFile = File(...), authorization: str | None = Header(None)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    raw = await file.read()
    try:
        result = parse_dna_file(raw, file.filename)
    except Exception as e:
        raise HTTPException(422, f"Could not parse DNA file: {e}")

    user_id = await _get_user_id(authorization)
    session_id = str(uuid.uuid4())
    session = {
        "snps": result["snps"],
        "ancestry": result.get("ancestry", {}),
        "sex": result.get("sex", "Unknown"),
        "source": result["source"],
        "user_id": user_id,
    }
    sessions[session_id] = session
    _save_session_disk(session_id, session)

    if user_id:
        _save_session_supabase(
            session_id, user_id, file.filename,
            result["source"], len(result["snps"]),
            result.get("ancestry", {}), raw,
        )

    return {
        "session_id": session_id,
        "source": result["source"],
        "snp_count": len(result["snps"]),
        "chromosomes": result["snps"]["chrom"].nunique(),
        "ancestry": result.get("ancestry", {}),
    }


@app.post("/api/report")
async def report(session_id: str, authorization: str | None = Header(None)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    user_id = await _get_user_id(authorization) or session.get("user_id")
    snps = session["snps"]
    ancestry = session.get("ancestry", {})
    sex = session.get("sex", "Unknown")

    if user_id:
        sb = get_supabase()
        if sb:
            sb.table("sessions").update({"status": "processing"}).eq("id", session_id).execute()

    pgx = run_pharmacogenomics(snps)
    risk = compute_risk_scores(snps, ancestry, sex)
    carriers = check_carrier_status(snps)
    nutrition = analyze_traits(snps, ancestry)

    modules = {
        "pharmacogenomics": pgx,
        "disease_risk": risk,
        "carrier_status": carriers,
        "nutrition_traits": nutrition,
    }

    llm_report = await generate_report(modules, ancestry)
    full_report = {**modules, "report_text": llm_report}
    session["results"] = full_report

    # Save to disk to survive server restarts
    _save_session_disk(session_id, session)

    if user_id:
        _save_report_supabase(session_id, user_id, modules, llm_report)

    # RAG: Background embed the report for chat
    from rag import embed_and_store_report
    import asyncio
    asyncio.create_task(embed_and_store_report(session_id, user_id or "anonymous", full_report, llm_report["full_text"]))

    return full_report


@app.post("/api/cv/selfie")
async def cv_selfie(session_id: str, image: UploadFile = File(...),
                    authorization: str | None = Header(None)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    from cv_selfie import analyze_selfie

    img_bytes = await image.read()
    result = analyze_selfie(img_bytes, session["snps"], session.get("ancestry", {}))

    user_id = await _get_user_id(authorization) or session.get("user_id") or "anonymous"
    _save_scan_supabase(session_id, user_id, "selfie", result, img_bytes)

    return result


@app.post("/api/cv/skin")
async def cv_skin(session_id: str, image: UploadFile = File(...),
                  authorization: str | None = Header(None)):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    from cv_skin import analyze_skin_lesion

    img_bytes = await image.read()
    result = analyze_skin_lesion(img_bytes, session["snps"])

    user_id = await _get_user_id(authorization) or session.get("user_id") or "anonymous"
    _save_scan_supabase(session_id, user_id, "skin", result, img_bytes)

    return result


@app.get("/api/sessions")
async def list_sessions(authorization: str = Header(...)):
    """Return all sessions for the authenticated user."""
    user_id = await _get_user_id(authorization)
    if not user_id:
        raise HTTPException(401, "Not authenticated")
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    result = sb.table("sessions") \
        .select("id, created_at, dna_source, snp_count, ancestry_group, status") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return result.data


@app.get("/api/scans/{session_id}")
async def list_scans(session_id: str, authorization: str | None = Header(None)):
    """Return all past scan results for the session, with signed image URLs."""
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    
    try:
        res = sb.table("scan_results") \
            .select("*") \
            .eq("session_id", session_id) \
            .order("created_at", desc=True) \
            .execute()
        scans = res.data or []
    except Exception as e:
        print(f"Failed to fetch scans (possibly invalid UUID): {e}")
        scans = []
    for scan in scans:
        if scan.get("image_path"):
            try:
                # Generate a signed URL valid for 1 hour
                signed = sb.storage.from_("scan-images").create_signed_url(scan["image_path"], 3600)
                if signed and "signedURL" in signed:
                    scan["image_url"] = signed["signedURL"]
            except Exception as e:
                print(f"Failed to sign URL for {scan['image_path']}: {e}")
                
    return scans


@app.get("/api/sessions/{session_id}/report")
async def get_saved_report(session_id: str, authorization: str = Header(...)):
    """Fetch a previously generated report from Supabase."""
    user_id = await _get_user_id(authorization)
    if not user_id:
        raise HTTPException(401, "Not authenticated")
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Supabase not configured")
    result = sb.table("reports") \
        .select("*") \
        .eq("session_id", session_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()
    if not result.data:
        raise HTTPException(404, "Report not found")
    return result.data


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


@app.post("/api/chat/{session_id}")
async def chat(session_id: str, request: Request, authorization: str | None = Header(None)):
    session = sessions.get(session_id)
    if not session:
        session = {}
        sessions[session_id] = session
        
    data = await request.json()
    message = data.get("message")
    if not message:
        raise HTTPException(400, "Message required")
        
    from rag import rag_search, _get_client
    
    sb = get_supabase()

    # Save the user message to chat_messages table
    if sb:
        try:
            sb.table("chat_messages").insert({
                "session_id": session_id,
                "role": "user",
                "content": message,
            }).execute()
        except Exception as e:
            print(f"Failed to save user chat message: {e}")

    # Fallback to Supabase if server restarted and memory is wiped
    raw_report = {}
    if session and "results" in session:
        raw_report = session["results"]
    elif sb:
        try:
            res = sb.table("processed_genomic_results").select("report_data").eq("session_id", session_id).execute()
            if res.data and len(res.data) > 0:
                raw_report = res.data[0].get("report_data", {}).get("report", {})
                session["results"] = raw_report
        except Exception as e:
            print(f"Fallback fetch failed for chat: {e}")

    # If we STILL don't have the report (e.g. anonymous user + server restarted), 
    # but we DO have their SNPs from the disk cache, we can re-compute the traits instantly!
    if not raw_report and session and "snps" in session:
        try:
            from risk_engine import compute_risk_scores
            from traits import analyze_traits
            from pgx import run_pharmacogenomics
            snps = session["snps"]
            ancestry = session.get("ancestry", {})
            sex = session.get("sex", "Unknown")
            raw_report = {
                "disease_risk": compute_risk_scores(snps, ancestry, sex),
                "nutrition_traits": analyze_traits(snps, ancestry),
                "pharmacogenomics": run_pharmacogenomics(snps)
            }
            session["results"] = raw_report
        except Exception as e:
            print(f"Failed to recompute missing traits: {e}")

    # Extract summaries to inject
    report_json_context = ""
    if raw_report:
        import json
        report_json_context = "\n\nRaw Genomic Data Summary:\n" + json.dumps({
            "nutrition_traits": raw_report.get("nutrition_traits"),
            "disease_risk": raw_report.get("disease_risk"),
            "pharmacogenomics": raw_report.get("pharmacogenomics"),
        }, indent=2)

    # 1. Get standard RAG context from their genome report
    context = await rag_search(session_id, message)
    
    # 2. Get past scans for this session to make the AI aware of their skin/selfie history
    scan_context = ""
    if sb:
        try:
            res = sb.table("scan_results").select("*").eq("session_id", session_id).order("created_at", desc=True).limit(5).execute()
            scans = res.data or []
            if scans:
                scan_context = "\n\nUser's Recent Computer Vision Scans:\n"
                for s in scans:
                    date = s.get("created_at", "")[:10]
                    stype = s.get("scan_type", "unknown")
                    if stype == "skin":
                        scan_context += f"- Date: {date}, Skin Lesion Scan: {s.get('urgency', 'Unknown')} urgency. Melanoma probability: {s.get('p_melanoma_raw', 0)}%. Fused Score (including MC1R genetics): {s.get('fused_score', 0)}%.\n"
                    elif stype == "selfie":
                        scan_context += f"- Date: {date}, Selfie Phenotype Scan: Detected {s.get('detected', {})}. Concordance with DNA: {s.get('concordance', 'Unknown')}.\n"
        except Exception as e:
            print(f"Failed to fetch scan history for chat context: {e}")

    system_prompt = f"""You are G-Nome, an AI health assistant. You are chatting with a user about their genetic health report.
Use the following context from their report to answer their questions. If the context does not contain the answer, say so.
Context from their report:
{context}{scan_context}{report_json_context}
"""

    # 3. Load previous conversation history from DB
    chat_history = []
    if sb:
        try:
            hist = sb.table("chat_messages").select("role, content").eq("session_id", session_id).order("created_at").execute()
            for row in (hist.data or []):
                chat_history.append({"role": row["role"], "content": row["content"]})
        except Exception as e:
            print(f"Failed to load chat history: {e}")
    
    # Build messages: system + history (includes current user message already saved)
    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend(chat_history)
    
    client = _get_client()
    if not client:
        raise HTTPException(503, "Nebius API not configured")
        
    try:
        response = await client.chat.completions.create(
            model=os.environ.get("NEBIUS_MODEL", "meta-llama/Llama-3.3-70B-Instruct"),
            messages=llm_messages,
            temperature=0.3,
            max_tokens=500
        )
        ai_response = response.choices[0].message.content

        # Save AI response to chat_messages table
        if sb:
            try:
                sb.table("chat_messages").insert({
                    "session_id": session_id,
                    "role": "assistant",
                    "content": ai_response,
                }).execute()
            except Exception as e:
                print(f"Failed to save AI chat message: {e}")

        return {"response": ai_response}
    except Exception as e:
        raise HTTPException(500, f"LLM error: {e}")


@app.get("/api/chat-history/{session_id}")
async def get_chat_history(session_id: str):
    """Return previous chat messages for a session."""
    sb = get_supabase()
    if not sb:
        return []
    try:
        res = sb.table("chat_messages").select("role, content, created_at").eq("session_id", session_id).order("created_at").execute()
        return res.data or []
    except Exception as e:
        print(f"Failed to fetch chat history: {e}")
        return []


@app.post("/api/meal-plan/{session_id}")
async def generate_meal_plan(session_id: str, authorization: str | None = Header(None)):
    session = sessions.get(session_id)
    traits = {}
    if session and "results" in session:
        traits = session["results"].get("nutrition_traits", {})
    else:
        # Fallback to Supabase if server restarted and memory is wiped
        sb = get_supabase()
        if sb:
            try:
                res = sb.table("processed_genomic_results").select("report_data").eq("session_id", session_id).execute()
                if res.data and len(res.data) > 0:
                    traits = res.data[0].get("report_data", {}).get("report", {}).get("nutrition_traits", {})
                    # Also restore to memory
                    if session is None:
                        sessions[session_id] = {}
                        session = sessions[session_id]
                    session["results"] = res.data[0].get("report_data", {}).get("report", {})
            except Exception as e:
                print(f"Fallback fetch failed: {e}")
                
    if not traits and session and "snps" in session:
        try:
            from traits import analyze_traits
            snps = session["snps"]
            ancestry = session.get("ancestry", {})
            traits = analyze_traits(snps, ancestry)
            if "results" not in session:
                session["results"] = {}
            session["results"]["nutrition_traits"] = traits
        except Exception as e:
            print(f"Failed to recompute traits for meal plan: {e}")

    if not traits:
        raise HTTPException(404, "Session/results not found. Run report first.")

    from rag import _get_client
    client = _get_client()
    if not client:
        raise HTTPException(503, "Nebius API not configured")
    
    system_prompt = """You are a genomic nutritionist. Given a user's genetic traits, generate a strict 7-day personalized meal and lifestyle plan.
Format the output as a beautiful markdown document with a daily schedule. Be extremely specific based on their traits (e.g. if lactose intolerant, mandate no dairy)."""

    try:
        response = await client.chat.completions.create(
            model=os.environ.get("NEBIUS_MODEL", "meta-llama/Llama-3.3-70B-Instruct"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"My traits: {json.dumps(traits)}"}
            ],
            temperature=0.4,
            max_tokens=1500
        )
        plan = response.choices[0].message.content
        
        # Save to supabase
        sb = get_supabase()
        if sb:
            try:
                sb.table("lifestyle_plans").insert({
                    "session_id": session_id,
                    "plan_data": {"markdown": plan}
                }).execute()
            except Exception as e:
                print(f"Failed to save plan to Supabase: {e}")
                
        return {"plan": plan}
    except Exception as e:
        raise HTTPException(500, f"LLM error: {e}")


@app.get("/api/lifestyle-plan/{session_id}")
async def get_lifestyle_plan(session_id: str):
    """Fetch saved lifestyle plan from Supabase."""
    sb = get_supabase()
    if not sb:
        return {"plan": None}
    try:
        res = sb.table("lifestyle_plans") \
            .select("plan_data, created_at") \
            .eq("session_id", session_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        if res.data and len(res.data) > 0:
            return {"plan": res.data[0]["plan_data"].get("markdown", ""), "created_at": res.data[0]["created_at"]}
        return {"plan": None}
    except Exception as e:
        print(f"Failed to fetch lifestyle plan: {e}")
        return {"plan": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
