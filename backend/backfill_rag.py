import asyncio
from main import sessions, _load_sessions_disk
from rag import embed_and_store_report

async def run():
    _load_sessions_disk()
    print(f"Found {len(sessions)} local sessions.")
    for session_id, session in sessions.items():
        if "results" in session:
            print(f"Embedding session {session_id}...")
            user_id = session.get("user_id") or "anonymous"
            full_report = session["results"]
            report_text = full_report.get("report_text", {}).get("full_text", "")
            if not report_text:
                print("No report text found, skipping.")
                continue
            try:
                await embed_and_store_report(session_id, user_id, full_report, report_text)
                print(f"Successfully embedded {session_id}")
            except Exception as e:
                print(f"Failed to embed {session_id}: {e}")

if __name__ == "__main__":
    asyncio.run(run())
