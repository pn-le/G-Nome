import sys
sys.path.append("backend")
from risk_engine import predict_user_risk

user_snps = {}
for i in range(50):
    user_snps[f"rs{1001+i}"] = 2 # simulate someone with all 2s
print("All 2s:", predict_user_risk(user_snps, 0))

user_snps = {}
for i in range(50):
    user_snps[f"rs{1001+i}"] = 0 # simulate someone with all 0s
print("All 0s:", predict_user_risk(user_snps, 0))
