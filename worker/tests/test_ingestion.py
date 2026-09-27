"""Contract tests that mock external download and transcription boundaries."""

import unittest
import tempfile
from dataclasses import replace
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import ValidationError

from app.main import app
from app.core.config import get_settings
from app.schemas.payload import (
    DocumentExtractionRequest,
    ExtractionRequest,
    NormalizedExtractionResponse,
)
from app.services.docling_service import DoclingExtractor
from app.services.media_service import MediaExtractor
from app.services.source_io import source_extension


class IngestionContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://worker.test",
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()

    async def test_health_and_validation(self) -> None:
        health = await self.client.get("/health")
        self.assertEqual(
            health.json(), {"status": "healthy", "service": "worker"}
        )
        invalid = await self.client.post(
            "/api/extract/auto",
            json={"job_id": "job-1", "source_url": "http://localhost/private.pdf"},
        )
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(invalid.json()["error"], "validation_error")

    async def test_auto_routes_documents_without_losing_job_id(self) -> None:
        expected = NormalizedExtractionResponse(
            job_id="job-2",
            source_type="document",
            title="Report",
            word_count=2,
            content_markdown="# Report",
        )
        with patch(
            "app.main.document_extractor.extract",
            new_callable=AsyncMock,
            return_value=expected,
        ) as extraction:
            response = await self.client.post(
                "/api/extract/auto",
                json={
                    "job_id": "job-2",
                    "source_url": "https://example.com/report.pdf?signature=secret",
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["job_id"], "job-2")
        extraction.assert_awaited_once()
        self.assertEqual(
            extraction.await_args.args[0].source_url,
            "https://example.com/report.pdf?signature=secret",
        )

    async def test_media_without_key_fails_explicitly(self) -> None:
        response = await self.client.post(
            "/api/extract/media",
            json={
                "job_id": "job-3",
                "source_url": "https://example.com/interview.mp3",
            },
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"], "transcription_unavailable")

    def test_source_contract_and_timeline_order(self) -> None:
        with self.assertRaises(ValidationError):
            ExtractionRequest(job_id="job-4", source_url="file:///etc/passwd")
        self.assertEqual(
            source_extension("s3://bucket/slides.pptx?versionId=1"), ".pptx"
        )
        segments = MediaExtractor._timeline(
            {
                "results": {
                    "utterances": [
                        {"start": 2, "end": 3, "speaker": 1, "transcript": "Later."},
                        {"start": 0, "end": 1, "speaker": 0, "transcript": "First."},
                    ]
                }
            }
        )
        self.assertEqual([segment.text for segment in segments], ["First.", "Later."])
        self.assertEqual(segments[1].speaker, "Speaker 1")

    async def test_document_scratch_is_removed_after_conversion_failure(self) -> None:
        staged: list[Path] = []

        async def direct_to_thread(function, *args):
            return function(*args)

        async def fake_download(source_url, directory, settings, suffix=None):
            path = directory / "source.pdf"
            path.write_bytes(b"%PDF-1.4")
            staged.append(path)
            return path

        with patch(
            "app.services.docling_service.download_source", side_effect=fake_download
        ), patch(
            "app.services.docling_service._convert_with_timeout",
            side_effect=RuntimeError("converter failed"),
        ), patch(
            "app.services.docling_service.asyncio.to_thread",
            side_effect=direct_to_thread,
        ):
            with self.assertRaisesRegex(RuntimeError, "converter failed"):
                await DoclingExtractor(get_settings()).extract(
                    DocumentExtractionRequest(
                        job_id="job-5",
                        source_url="https://example.com/report.pdf",
                    )
                )
        self.assertEqual(len(staged), 1)
        self.assertFalse(staged[0].exists())

    async def test_deepgram_request_enables_diarized_utterances(self) -> None:
        original_client = httpx.AsyncClient

        def respond(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.params["punctuate"], "true")
            self.assertEqual(request.url.params["diarize_model"], "latest")
            self.assertEqual(request.url.params["utterances"], "true")
            self.assertEqual(request.headers["authorization"], "Token test-key")
            return httpx.Response(
                200,
                json={"results": {"utterances": []}},
            )

        def client_factory(*args, **kwargs):
            return original_client(
                *args,
                transport=httpx.MockTransport(respond),
                **kwargs,
            )

        async def direct_to_thread(function, *args):
            return function(*args)

        with tempfile.TemporaryDirectory() as scratch:
            audio = Path(scratch) / "audio.mp3"
            audio.write_bytes(b"fake audio")
            extractor = MediaExtractor(
                replace(get_settings(), deepgram_api_key="test-key")
            )
            with patch(
                "app.services.media_service.httpx.AsyncClient",
                side_effect=client_factory,
            ), patch(
                "app.services.media_service.asyncio.to_thread",
                side_effect=direct_to_thread,
            ):
                payload = await extractor._transcribe(audio)
        self.assertEqual(payload, {"results": {"utterances": []}})


if __name__ == "__main__":
    unittest.main()
