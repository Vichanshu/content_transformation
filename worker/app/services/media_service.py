"""FFmpeg audio preparation and Deepgram diarized transcription."""

import asyncio
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import httpx

from app.core.config import Settings
from app.schemas.payload import (
    MediaExtractionRequest,
    NormalizedExtractionResponse,
    TimelineSegment,
)
from app.services.docling_service import clean_text
from app.services.source_io import download_source, source_extension

_VIDEO_EXTENSIONS = {".mp4", ".mov"}


class TranscriptionUnavailableError(Exception):
    """Deepgram cannot process the media in the current configuration."""


class MediaProcessingError(Exception):
    """FFmpeg or Deepgram rejected a media source."""


def _time_label(seconds: float) -> str:
    whole = int(seconds)
    return f"{whole // 3600:02d}:{(whole % 3600) // 60:02d}:{whole % 60:02d}"


class MediaExtractor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def extract(
        self, request: MediaExtractionRequest, *, media_type: str | None = None
    ) -> NormalizedExtractionResponse:
        if not self.settings.deepgram_api_key:
            raise TranscriptionUnavailableError(
                "DEEPGRAM_API_KEY is required for media transcription"
            )
        with tempfile.TemporaryDirectory(prefix="cte-media-") as scratch:
            directory = Path(scratch)
            source = await download_source(
                request.source_url, directory, self.settings
            )
            audio = directory / "audio-16khz.mp3"
            await asyncio.to_thread(self._extract_audio, source, audio)
            payload = await self._transcribe(audio)
            segments = self._timeline(payload)
            if not segments:
                raise MediaProcessingError("Deepgram returned no utterances")
            markdown = "\n".join(
                f"[{_time_label(segment.start_seconds)} - "
                f"{segment.speaker or 'Speaker unknown'}]: {segment.text}"
                for segment in segments
            )
            name = Path(unquote(urlparse(request.source_url).path)).name
            kind = media_type or (
                "video" if source_extension(request.source_url) in _VIDEO_EXTENSIONS
                else "audio"
            )
            return NormalizedExtractionResponse(
                job_id=request.job_id,
                source_type=kind,
                title=name or None,
                word_count=sum(len(segment.text.split()) for segment in segments),
                content_markdown=markdown,
                timeline=segments,
                metadata={
                    "source_name": name,
                    "transcription_provider": "deepgram",
                    "segment_count": len(segments),
                },
            )

    def _extract_audio(self, source: Path, destination: Path) -> None:
        command = [
            "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
            "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000",
            "-b:a", "32k", str(destination),
        ]
        try:
            subprocess.run(
                command, check=True, capture_output=True,
                timeout=self.settings.ffmpeg_timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            raise MediaProcessingError("FFmpeg processing timed out") from exc
        except subprocess.CalledProcessError as exc:
            raise MediaProcessingError(
                f"FFmpeg failed: {exc.stderr.decode(errors='replace')[:500]}"
            ) from exc
        if not destination.exists() or destination.stat().st_size == 0:
            raise MediaProcessingError("FFmpeg produced no audio")

    async def _transcribe(self, audio: Path) -> dict[str, Any]:
        content = await asyncio.to_thread(audio.read_bytes)
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.deepgram_timeout_seconds
            ) as client:
                response = await client.post(
                    "https://api.deepgram.com/v1/listen",
                    params={
                        "punctuate": "true",
                        "diarize_model": "latest",
                        "utterances": "true",
                    },
                    headers={
                        "Authorization": f"Token {self.settings.deepgram_api_key}",
                        "Content-Type": "audio/mpeg",
                    },
                    content=content,
                )
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise MediaProcessingError("Deepgram transcription failed") from exc

    @staticmethod
    def _timeline(payload: dict[str, Any]) -> list[TimelineSegment]:
        utterances = payload.get("results", {}).get("utterances", [])
        segments: list[TimelineSegment] = []
        for utterance in utterances:
            text = clean_text(str(utterance.get("transcript", "")))
            if not text:
                continue
            speaker_id = utterance.get("speaker")
            segments.append(
                TimelineSegment(
                    start_seconds=float(utterance["start"]),
                    end_seconds=float(utterance["end"]),
                    speaker=(
                        f"Speaker {speaker_id}" if speaker_id is not None else None
                    ),
                    text=text,
                )
            )
        return sorted(segments, key=lambda segment: segment.start_seconds)
