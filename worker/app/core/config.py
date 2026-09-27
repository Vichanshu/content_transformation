"""Environment-backed worker limits and integrations."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    cors_allowed_origins: tuple[str, ...]
    deepgram_api_key: str | None
    max_source_bytes: int
    source_timeout_seconds: float
    docling_timeout_seconds: int
    ffmpeg_timeout_seconds: int
    deepgram_timeout_seconds: float


def get_settings() -> Settings:
    origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
    return Settings(
        cors_allowed_origins=tuple(
            origin.strip() for origin in origins.split(",") if origin.strip()
        ),
        deepgram_api_key=os.getenv("DEEPGRAM_API_KEY") or None,
        max_source_bytes=int(os.getenv("MAX_SOURCE_BYTES", str(100 * 1024 * 1024))),
        source_timeout_seconds=float(os.getenv("SOURCE_TIMEOUT_SECONDS", "60")),
        docling_timeout_seconds=int(os.getenv("DOCLING_TIMEOUT_SECONDS", "300")),
        ffmpeg_timeout_seconds=int(os.getenv("FFMPEG_TIMEOUT_SECONDS", "120")),
        deepgram_timeout_seconds=float(os.getenv("DEEPGRAM_TIMEOUT_SECONDS", "120")),
    )
