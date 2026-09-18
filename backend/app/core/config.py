import os
import urllib.parse
from typing import List

from dotenv import load_dotenv

load_dotenv()

class Settings:
    # MongoDB
    MONGODB_URI_FIRST = os.getenv("MONGODB_URI_FIRST")
    MONGODB_URI_PASS = os.getenv("MONGODB_URI_PASS")
    MONGODB_URI_LAST = os.getenv("MONGODB_URI_LAST")

    @property
    def MONGODB_URI(self):
        if not self.MONGODB_URI_FIRST or not self.MONGODB_URI_PASS or not self.MONGODB_URI_LAST:
            raise ValueError("Missing MongoDB Environment Variables")
        return f"{self.MONGODB_URI_FIRST}{urllib.parse.quote(self.MONGODB_URI_PASS)}{self.MONGODB_URI_LAST}"

    # Secrets
    SECRET_KEY = os.getenv("SECRET_KEY")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # App
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS = 7

    # CORS — set CORS_ORIGINS env var as a comma-separated list in production
    # Fallback keeps local dev working out of the box
    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "")
        if raw:
            return [o.strip() for o in raw.split(",") if o.strip()]
        return [
            "https://animated-barnacle-ai-doc-parser-fro.vercel.app",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

settings = Settings()
