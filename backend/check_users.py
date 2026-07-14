import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME", "genieai")
    
    try:
        client = AsyncIOMotorClient(mongo_uri)
        db = client[db_name]
        
        collections = await db.list_collection_names()
        
        for col_name in collections:
            print(f"\nCollection: {col_name}")
            cursor = db[col_name].find({})
            docs = await cursor.to_list(length=100)
            for d in docs:
                # print only fields with ascii-safe info
                summary = {}
                if "tenant_id" in d:
                    summary["tenant_id"] = d["tenant_id"]
                if "email" in d:
                    summary["email"] = d["email"]
                if "company_name" in d:
                    # check if ascii printable or just avoid printing name
                    summary["has_company_name"] = bool(d["company_name"])
                if "document_name" in d:
                    summary["document_id"] = d.get("document_id")
                print(" - ", summary)
                
    except Exception as e:
        print("Error checking DB:", e)

if __name__ == "__main__":
    asyncio.run(check_db())
