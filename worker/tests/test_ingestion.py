"""Routing contracts for the two extraction tracks."""

import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.main import app
from app.schemas.payload import NormalizedExtractionResponse


class IngestionContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://worker.test"
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()

    async def test_health_and_https_validation(self) -> None:
        health = await self.client.get("/health")
        self.assertEqual(health.json(), {"status": "healthy", "service": "worker"})
        invalid = await self.client.post(
            "/api/extract/auto",
            json={"job_id": "job-1", "source_url": "http://localhost/private.pdf"},
        )
        self.assertEqual(invalid.status_code, 422)

    async def test_auto_routes_pdf_to_docling(self) -> None:
        expected = NormalizedExtractionResponse(
            job_id="document-1", source_type="document", title="Report",
            word_count=2, content_markdown="# Report",
        )
        with patch(
            "app.main.document_extractor.extract", new_callable=AsyncMock,
            return_value=expected,
        ) as extract:
            response = await self.client.post(
                "/api/extract/auto",
                json={"job_id": "document-1", "source_url": "https://example.com/report.pdf"},
            )
        self.assertEqual(response.status_code, 200)
        extract.assert_awaited_once()

    async def test_auto_routes_video_to_ffmpeg_and_gemini(self) -> None:
        expected = NormalizedExtractionResponse(
            job_id="media-1", source_type="video", title="Interview",
            word_count=2, content_markdown="Transcript text",
        )
        with patch(
            "app.main.extract_media_endpoint", new_callable=AsyncMock,
            return_value=expected,
        ) as extract:
            response = await self.client.post(
                "/api/extract/auto",
                json={"job_id": "media-1", "source_url": "https://example.com/interview.mp4"},
            )
        self.assertEqual(response.status_code, 200)
        extract.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
