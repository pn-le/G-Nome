const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/backend/main.py';
let code = fs.readFileSync(p, 'utf8');

code = code.replace("from parser import parse_dna_file", "from .parser import parse_dna_file");
code = code.replace("from pgx import run_pharmacogenomics", "from .pgx import run_pharmacogenomics");
code = code.replace("from prs import compute_risk_scores", "from .prs import compute_risk_scores");
code = code.replace("from carrier import check_carrier_status", "from .carrier import check_carrier_status");
code = code.replace("from traits import analyze_traits", "from .traits import analyze_traits");
code = code.replace("from report import generate_report", "from .report import generate_report");
code = code.replace("from pdf import render_pdf", "from .pdf import render_pdf");
code = code.replace("from supabase_client import get_supabase", "from .supabase_client import get_supabase");

code = code.replace("from cv_selfie import analyze_selfie", "from .cv_selfie import analyze_selfie");
code = code.replace("from cv_skin import analyze_skin_lesion", "from .cv_skin import analyze_skin_lesion");
code = code.replace("from rag import embed_and_store_report", "from .rag import embed_and_store_report");
code = code.replace("from rag import rag_search, _get_client", "from .rag import rag_search, _get_client");

fs.writeFileSync(p, code);
