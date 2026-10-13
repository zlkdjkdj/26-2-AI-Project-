import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

def local_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else BASE_DIR / path

DATABASE_PATH = local_path(os.getenv('DATABASE_PATH', 'data/atchacha.db'))
UPLOAD_DIR = local_path(os.getenv('UPLOAD_DIR', 'data/uploads'))
CORS_ORIGINS = [s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if s.strip()]
MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_MB', '8')) * 1024 * 1024
