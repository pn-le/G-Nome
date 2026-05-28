import sys
sys.path.append("backend")
from risk_engine import predict_user_risk
import hashlib

def mock_hash(rsid, gt):
    hash_val = int(hashlib.md5(f"{rsid}{gt}".encode()).hexdigest(), 16)
    mod = hash_val % 10
    if mod < 6: return 0
    elif mod < 9: return 1
    else: return 2

user_snps = {}
for i in range(50):
    user_snps[f"rs{1001+i}"] = mock_hash(f"rs{12345+i}", "AA")

print("Hash version:", predict_user_risk(user_snps, 0))
