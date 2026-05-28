from dotenv import load_dotenv
load_dotenv()
from supabase_client import get_supabase
sb = get_supabase()
res = sb.table("processed_genomic_results").select("*").limit(1).execute()
print(res.data[0].get("report_data").get("report").keys())
