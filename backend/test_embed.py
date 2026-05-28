import asyncio, os, openai
from dotenv import load_dotenv
load_dotenv()
async def run():
    client = openai.AsyncOpenAI(api_key=os.environ["NEBIUS_API_KEY"], base_url=os.environ["NEBIUS_BASE_URL"])
    res = await client.embeddings.create(model="Qwen/Qwen3-Embedding-8B", input=["Hello world"])
    print(len(res.data[0].embedding))
asyncio.run(run())
