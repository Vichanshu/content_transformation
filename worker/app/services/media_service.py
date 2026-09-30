"""FFmpeg preparation and Gemini free-tier transcription for media sources."""

import asyncio
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from app.core.config import Settings
from app.schemas.payload import (
    MediaExtractionRequest,
    NormalizedExtractionResponse,
    TimelineSegment,
)
from app.services.docling_service import clean_text
from app.services.source_io import download_source, source_extension

_VIDEO_EXTENSIONS = {".mp4", ".mov"}


class MediaProcessingError(Exception):
    """FFmpeg or Gemini could not produce a transcript."""


class MediaExtractor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def extract(
        self, request: MediaExtractionRequest, *, media_type: str
    ) -> NormalizedExtractionResponse:
        if not self.settings.gemini_api_key:
            raise MediaProcessingError("GEMINI_API_KEY is required for media transcription")
        with tempfile.TemporaryDirectory(prefix="cte-media-") as scratch:
            directory = Path(scratch)
            source = await download_source(request.source_url, directory, self.settings)
            audio = directory / "audio-16khz.wav"
            duration = await asyncio.to_thread(self._extract_audio, source, audio)
            transcript = await asyncio.to_thread(self._transcribe_with_gemini, audio)
        segments = self._segments(transcript, duration)
        if not segments:
            raise MediaProcessingError("Gemini returned no transcript text")
        markdown = "\n".join(
            f"[{self._time_label(item.start_seconds)}]: {item.text}" for item in segments
        )
        source_name = Path(unquote(urlparse(request.source_url).path)).name
        return NormalizedExtractionResponse(
            job_id=request.job_id,
            source_type=media_type,
            title=str(transcript.get("title") or source_name or "Media transcript"),
            word_count=sum(len(item.text.split()) for item in segments),
            content_markdown=markdown,
            timeline=segments,
            metadata={
                "extractor": "ffmpeg+gemini",
                "model": self.settings.gemini_media_model,
                "source_name": source_name,
                "duration_seconds": duration,
            },
        )

    def _extract_audio(self, source: Path, destination: Path) -> float:
        command = [
            "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
            "-i", str(source), "-vn", "-ac", "1", "-ar", "16000", str(destination),
        ]
        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                timeout=self.settings.ffmpeg_timeout_seconds,
            )
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(source)],
                check=True,
                capture_output=True,
                text=True,
                timeout=20,
            )
            return max(0.0, float(probe.stdout.strip()))
        except subprocess.TimeoutExpired as exc:
            raise MediaProcessingError("FFmpeg processing timed out") from exc
        except (subprocess.CalledProcessError, ValueError) as exc:
            detail = getattr(exc, "stderr", b"")
            if isinstance(detail, bytes):
                detail = detail.decode(errors="replace")
            raise MediaProcessingError(f"FFmpeg failed: {str(detail)[:500]}") from exc

    def _transcribe_with_gemini(self, audio: Path) -> dict[str, Any]:
        from google import genai

        client = genai.Client(api_key=self.settings.gemini_api_key)
        uploaded = None
        try:
            uploaded = client.files.upload(
                file=str(audio), config={"mime_type": "audio/wav"}
            )
            response = client.models.generate_content(
                model=self.settings.gemini_media_model,
                contents=[
                    uploaded,
                    "Transcribe this audio faithfully. Return JSON only: "
                    '{"title":string,"segments":[{"start_seconds":number,'
                    '"end_seconds":number,"speaker":string|null,"text":string}]}. '
                    "Use chronological timestamps when discernible; otherwise return one segment."
                ],
                config={"response_mime_type": "application/json", "temperature": 0},
            )
            return json.loads(response.text or "{}")
        except (Exception, json.JSONDecodeError) as exc:
            raise MediaProcessingError("Gemini transcription failed") from exc
        finally:
            if uploaded is not None:
                try:
                    client.files.delete(name=uploaded.name)
                except Exception:
                    pass

    @staticmethod
    def _segments(payload: dict[str, Any], duration: float) -> list[TimelineSegment]:
        result: list[TimelineSegment] = []
        for item in payload.get("segments", []):
            if not isinstance(item, dict):
                continue
            text = clean_text(str(item.get("text", "")))
            if not text:
                continue
            start = max(0.0, float(item.get("start_seconds", 0)))
            end = max(start, float(item.get("end_seconds", duration)))
            result.append(TimelineSegment(
                start_seconds=start,
                end_seconds=end,
                speaker=str(item["speaker"]) if item.get("speaker") else None,
                text=text,
            ))
        return sorted(result, key=lambda item: item.start_seconds)

    @staticmethod
    def _time_label(seconds: float) -> str:
        whole = int(seconds)
        return f"{whole // 3600:02d}:{(whole % 3600) // 60:02d}:{whole % 60:02d}"
