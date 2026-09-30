"""Article and YouTube routing contracts without external downloads."""

import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.main import app
from app.schemas.payload import NormalizedExtractionResponse
from app.services.text_service import ArticleParser, youtube_video_id


class TextSourceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://worker.test",
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()

    def test_article_parser_keeps_facts_and_tables(self) -> None:
        parser = ArticleParser()
        parser.feed(
            "<html><head><title>Quarterly Review</title></head><body>"
            "<nav>Ignore me</nav><h1>Results</h1><p>Revenue rose 12%.</p>"
            "<table><tr><th>Year</th><th>USD</th></tr>"
            "<tr><td>2026</td><td>42</td></tr></table></body></html>"
        )
        self.assertEqual(parser.title, "Quarterly Review")
        self.assertEqual(parser.headings[0].text, "Results")
        self.assertIn("Revenue rose 12%.", "".join(parser.parts))
        self.assertNotIn("Ignore me", "".join(parser.parts))
        self.assertEqual(parser.tables[0].rows[0], ["2026", "42"])

    def test_youtube_id_allows_only_expected_hosts(self) -> None:
        self.assertEqual(
            youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            "dQw4w9WgXcQ",
        )
        self.assertEqual(
            youtube_video_id("https://youtu.be/dQw4w9WgXcQ"),
            "dQw4w9WgXcQ",
        )
        self.assertIsNone(youtube_video_id("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"))

    async def test_auto_routes_html_to_text_extractor(self) -> None:
        expected = NormalizedExtractionResponse(
            job_id="article-1", source_type="document", title="Review",
            word_count=3, content_markdown="Revenue rose 12%.",
        )
        with patch("app.main.source_mime_type", new_callable=AsyncMock, return_value="text/html"), patch(
            "app.main.extract_text_source", new_callable=AsyncMock, return_value=expected
        ) as extract:
            response = await self.client.post(
                "/api/extract/auto",
                json={"job_id": "article-1", "source_url": "https://example.com/news"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "Review")
        extract.assert_awaited_once()

    async def test_auto_routes_youtube_to_caption_extractor(self) -> None:
        expected = NormalizedExtractionResponse(
            job_id="video-1", source_type="video", title="Video",
            word_count=2, content_markdown="Key fact.",
        )
        with patch("app.main.extract_youtube", new_callable=AsyncMock, return_value=expected) as extract:
            response = await self.client.post(
                "/api/extract/auto",
                json={"job_id": "video-1", "source_url": "https://youtu.be/dQw4w9WgXcQ"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source_type"], "video")
        extract.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
