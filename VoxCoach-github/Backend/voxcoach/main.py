import logging
import os

from dotenv import load_dotenv

# Load .env BEFORE importing settings
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analysis_router
from app.firebase_admin import init_firebase

logger = logging.getLogger(__name__)

app = FastAPI(title="VoxCoach API", version="0.1.0")

# Adjust CORS origin from settings or defaults
cors_origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    os.makedirs(settings.temp_dir, exist_ok=True)
    init_firebase()
    key = settings.gemini_api_key
    logger.info("Gemini API key loaded: %s...%s", key[:8], key[-4:] if len(key) > 8 else "???")


app.include_router(analysis_router.router, prefix="/api/analysis", tags=["analysis"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
