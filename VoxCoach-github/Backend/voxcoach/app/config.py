import os

from pydantic_settings import BaseSettings

# Absolute path to .env next to main.py
_ENV_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


class Settings(BaseSettings):
    gemini_api_key: str = ""
    groq_api_key: str = ""
    firebase_service_account_path: str = "./firebase-service-account.json"
    firebase_service_account_json: str = ""
    firebase_storage_bucket: str = "your-project-id.appspot.com"
    temp_dir: str = "/tmp/voxcoach"
    allowed_origins: str = "http://localhost:5173"

    model_config = {"env_file": _ENV_FILE, "extra": "ignore"}


settings = Settings()
