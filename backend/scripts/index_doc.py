import sys
import os
import asyncio

# Adjust Python path to allow running from the root of the backend folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set logging config before imports
import logging
logging.basicConfig(level=logging.INFO)

from app.services.parsing import parse_pdf
from app.services.rag import index_document

async def main():
    if len(sys.argv) < 2:
        print("[USAGE] Usage: python scripts/index_doc.py <path_to_pdf_file>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"[ERROR] Error: File '{pdf_path}' not found.")
        sys.exit(1)
        
    print(f"[INFO] Parsing and indexing document: '{pdf_path}'...")
    try:
        # 1. Parse text and extract images
        parsed_doc = await parse_pdf(pdf_path, tenant_id="default")
        
        # 2. Index parsed chunks into ChromaDB
        await index_document(parsed_doc, tenant_id="default")
        
        print("[SUCCESS] Document parsed and vectors successfully indexed!")
        print(f"[INFO] Document ID: {parsed_doc['document_id']}")
        print(f"[INFO] Pages processed: {len(parsed_doc['pages'])}")
    except Exception as e:
        print(f"[ERROR] Error occurred during indexing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure environment variables are loaded if running script directly
    from dotenv import load_dotenv
    load_dotenv()
    
    asyncio.run(main())
