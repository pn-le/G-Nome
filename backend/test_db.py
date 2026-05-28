import os
from dotenv import load_dotenv
load_dotenv()
from supabase_client import get_supabase
sb = get_supabase()
print(sb.table("scan_results").select("session_id").limit(1).execute())
