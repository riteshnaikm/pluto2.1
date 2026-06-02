import asyncio
import logging
from hypercorn.config import Config
from hypercorn.asyncio import serve
from app import asgi_app, initialize_pinecone, build_bm25_index, setup_llm_chain
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Check HR_docs folder
hr_docs_path = "HR_docs/"
if not os.path.exists(hr_docs_path):
    logging.error(f"❌ HR_docs folder not found at: {os.path.abspath(hr_docs_path)}")
    os.makedirs(hr_docs_path)
    logging.info("✅ Created HR_docs folder")
else:
    pdf_files = [f for f in os.listdir(hr_docs_path) if f.endswith('.pdf')]
    logging.info(f"📚 Found {len(pdf_files)} PDF files in HR_docs folder:")
    for pdf in pdf_files:
        logging.info(f"   - {pdf}")

async def main():
    # Set up logging
    logging.basicConfig(level=logging.INFO,
                       format='%(asctime)s - %(levelname)s - %(message)s')
    
    try:
        # Initialize Pinecone
        logging.info("🔧 Initializing Pinecone...")
        initialize_pinecone()
        
        # Build BM25 index
        logging.info("🔍 Building BM25 index...")
        build_bm25_index(hr_docs_path)
        
        # Set up LLM and QA chain
        logging.info("🤖 Setting up LLM and QA chain...")
        setup_llm_chain()

        try:
            from app import warm_llm_providers
            warm_llm_providers()
        except Exception as warm_err:
            logging.debug("LLM warm-up skipped: %s", warm_err)
        
        # Start server
        logging.info("🚀 Starting HR Assistant Suite...")
        config = Config()
        
        # Detect environment: Windows = local dev, Linux = production
        is_windows = os.name == 'nt'
        
        # Always use HTTP (HTTPS disabled for easier access)
        if is_windows:
            config.bind = ["127.0.0.1:5000"]  # Localhost for Windows (local dev)
            logging.info("🌐 HTTP server running on http://127.0.0.1:5000 (local development)")
        else:
            config.bind = ["0.0.0.0:5000"]  # All interfaces for Linux (production)
            logging.info("🌐 HTTP server running on http://0.0.0.0:5000 (production)")
        
        # Flask via WSGI adapter doesn't implement ASGI lifespan hooks.
        config.lifespan = "off"
        # Reload Python on file save (dev only). Templates/JS also refresh via pluto dev config.
        config.use_reloader = os.getenv("FLASK_ENV", "").lower() not in (
            "production",
            "prod",
        )
        if config.use_reloader:
            logging.info(
                "♻️ Dev reloader ON — save a .py file to restart the worker "
                "(first load is slow). For JS/CSS/templates, a normal browser refresh is enough."
            )
        await serve(asgi_app, config)
        
    except Exception as e:
        logging.error(f"❌ Startup error: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 