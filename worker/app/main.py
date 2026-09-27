"""FastAPI entry point for multimodal extraction."""

import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.payload import (
    DocumentExtractionRequest,
    ExtractionRequest,
    MediaExtractionRequest,
    NormalizedExtractionResponse,
)
from app.services.docling_service import DoclingExtractor
from app.services.media_service import (
    MediaExtractor,
    MediaProcessingError,
    TranscriptionUnavailableError,
)
from app.services.source_io import SourceError, source_extension, source_mime_type

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()
document_extractor = DoclingExtractor(settings)
media_extractor = MediaExtractor(settings)
app = FastAPI(title="Content Transformation Extraction Worker", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

_DOCUMENT_EXTENSIONS = {".pdf", ".pptx", ".docx"}
_VIDEO_EXTENSIONS = {".mp4", ".mov"}
_AUDIO_EXTENSIONS = {".mp3", ".wav"}
_DOCUMENT_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_VIDEO_MIMES = {"video/mp4", "video/quicktime"}
_AUDIO_MIMES = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request_failed method=%s path=%s", request.method, request.url.path
        )
        raise
    logger.info(
        "request method=%s path=%s status=%d duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        (time.monotonic() - started) * 1000,
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "details": [
                {"location": list(item["loc"]), "message": item["msg"]}
                for item in exc.errors()
            ],
        },
    )


@app.exception_handler(SourceError)
async def source_error_handler(request: Request, exc: SourceError) -> JSONResponse:
    logger.warning("source_error path=%s detail=%s", request.url.path, exc)
    return JSONResponse(
        status_code=422, content={"error": "source_error", "detail": str(exc)}
    )


@app.exception_handler(TranscriptionUnavailableError)
async def transcription_unavailable_handler(
    request: Request, exc: TranscriptionUnavailableError
) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"error": "transcription_unavailable", "detail": str(exc)},
    )


@app.exception_handler(MediaProcessingError)
async def media_error_handler(
    request: Request, exc: MediaProcessingError
) -> JSONResponse:
    logger.warning("media_error path=%s detail=%s", request.url.path, exc)
    return JSONResponse(
        status_code=502, content={"error": "media_processing_error", "detail": str(exc)}
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy", "service": "worker"}


@app.post("/api/extract/document", response_model=NormalizedExtractionResponse)
async def extract_document_endpoint(
    request: DocumentExtractionRequest,
) -> NormalizedExtractionResponse:
    if source_extension(request.source_url) not in _DOCUMENT_EXTENSIONS:
        mime = await source_mime_type(request.source_url, settings)
        if mime not in _DOCUMENT_MIMES:
            raise HTTPException(status_code=415, detail="Unsupported document type")
    return await document_extractor.extract(request)


@app.post("/api/extract/media", response_model=NormalizedExtractionResponse)
async def extract_media_endpoint(
    request: MediaExtractionRequest,
) -> NormalizedExtractionResponse:
    extension = source_extension(request.source_url)
    if extension in _VIDEO_EXTENSIONS:
        media_type = "video"
    elif extension in _AUDIO_EXTENSIONS:
        media_type = "audio"
    else:
        mime = await source_mime_type(request.source_url, settings)
        if mime in _VIDEO_MIMES:
            media_type = "video"
        elif mime in _AUDIO_MIMES:
            media_type = "audio"
        else:
            raise HTTPException(status_code=415, detail="Unsupported media type")
    return await media_extractor.extract(request, media_type=media_type)


@app.post("/api/extract/auto", response_model=NormalizedExtractionResponse)
async def extract_auto_endpoint(
    request: ExtractionRequest,
) -> NormalizedExtractionResponse:
    extension = source_extension(request.source_url)
    if extension in _DOCUMENT_EXTENSIONS:
        return await document_extractor.extract(
            DocumentExtractionRequest(**request.model_dump())
        )
    if extension in _VIDEO_EXTENSIONS | _AUDIO_EXTENSIONS:
        return await extract_media_endpoint(
            MediaExtractionRequest(**request.model_dump())
        )
    mime = await source_mime_type(request.source_url, settings)
    if mime in _DOCUMENT_MIMES:
        return await document_extractor.extract(
            DocumentExtractionRequest(**request.model_dump())
        )
    if mime in _VIDEO_MIMES | _AUDIO_MIMES:
        return await extract_media_endpoint(
            MediaExtractionRequest(**request.model_dump())
        )
    raise HTTPException(status_code=415, detail="Unsupported source type")
