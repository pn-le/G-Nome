import re

with open("backend/main.py", "r") as f:
    content = f.read()

# 1. Add router import
if "from cultural_rag.api import router as cultural_router" not in content:
    content = content.replace(
        "from supabase_client import get_supabase",
        "from supabase_client import get_supabase\nfrom cultural_rag.api import router as cultural_router"
    )

# 2. Add app.include_router
if "app.include_router(cultural_router" not in content:
    content = content.replace(
        "app.add_middleware(",
        "app.include_router(cultural_router, prefix=\"/api\")\n\napp.add_middleware("
    )

# 3. Update async def chat
old_chat = """    client = _get_client()
    if not client:
        raise HTTPException(503, "Nebius API not configured")"""

new_chat = """    from rag import rag_search, _get_client
    
    context = await rag_search(session_id, message)
    system_prompt = f\"\"\"You are G-Nome, an AI health assistant. You are chatting with a user about their genetic health report.
Use the following context from their report to answer their questions. If the context does not contain the answer, say so.
Context from their report:
{context}
\"\"\"
    
    client = _get_client()
    if not client:
        raise HTTPException(503, "Nebius API not configured")"""

if "rag_search(session_id, message)" not in content:
    content = content.replace(old_chat, new_chat)
    
    # Also update the messages array for LLM inside chat endpoint
    content = content.replace(
        'messages = [{"role": "system", "content": "You are G-Nome, an AI health assistant. You are chatting with a user about their genetic health report."}]',
        'messages = [{"role": "system", "content": system_prompt}]'
    )

with open("backend/main.py", "w") as f:
    f.write(content)
