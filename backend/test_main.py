import os
from dotenv import load_dotenv
load_dotenv()
from supabase_client import get_supabase

sb = get_supabase()
session_id = "744282b80d18"
res = sb.table("processed_genomic_results").select("report_data").eq("session_id", session_id).execute()
print(res.data[0].get("report_data", {}).get("report", {}).keys())
print(res.data[0].get("report_data", {}).get("report", {}).get("nutrition_traits", {}).keys())
