import asyncio
from dotenv import load_dotenv
load_dotenv()
from supabase_client import get_supabase
from rag import embed_and_store_report

async def run():
    sb = get_supabase()
    if not sb:
        print("No Supabase connection.")
        return
        
    print("Fetching reports from Supabase...")
    res = sb.table("processed_genomic_results").select("*").execute()
    records = res.data
    print(f"Found {len(records)} reports in database.")
    
    for row in records:
        session_id = row.get("session_id")
        report_data = row.get("report_data", {})
        
        full_report = report_data.get("report", {})
        
        user_id = "anonymous"
        
        report_text = full_report.get("report_text", {}).get("full_text", "")
        if not report_text:
            print(f"No report text found for session {session_id}, skipping.")
            continue
            
        print(f"Embedding session {session_id}...")
        try:
            await embed_and_store_report(session_id, user_id, full_report, report_text)
            print(f"Successfully embedded {session_id}")
        except Exception as e:
            print(f"Failed to embed {session_id}: {e}")

if __name__ == "__main__":
    asyncio.run(run())
