"""Normalize public HTML, text documents, and available YouTube captions."""

import asyncio
import re
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app.core.config import Settings
from app.schemas.payload import (
    DocumentHeading,
    DocumentTable,
    ExtractionRequest,
    NormalizedExtractionResponse,
    TimelineSegment,
)
from app.services.source_io import SourceError, download_source


class ArticleParser(HTMLParser):
    """Extract readable blocks while excluding scripts and navigation."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.headings: list[DocumentHeading] = []
        self.tables: list[DocumentTable] = []
        self.ignored: list[str] = []
        self.title = ""
        self.in_title = False
        self.heading_level: int | None = None
        self.heading_text = ""
        self.rows: list[list[str]] = []
        self.row: list[str] = []
        self.cell: str | None = None
        self.in_table = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "nav", "footer", "noscript", "svg"}:
            self.ignored.append(tag)
        if self.ignored:
            return
        if tag == "title":
            self.in_title = True
        if tag in {"p", "div", "br", "li", "section", "article"}:
            self.parts.append("\n")
        if re.fullmatch(r"h[1-6]", tag):
            self.heading_level = int(tag[1])
            self.heading_text = ""
            self.parts.append("\n" + "#" * self.heading_level + " ")
        if tag == "table":
            self.in_table = True
            self.rows = []
        elif tag == "tr":
            self.row = []
        elif tag in {"th", "td"}:
            self.cell = ""

    def handle_endtag(self, tag: str) -> None:
        if self.ignored:
            if tag == self.ignored[-1]:
                self.ignored.pop()
            return
        if tag == "title":
            self.in_title = False
        if re.fullmatch(r"h[1-6]", tag) and self.heading_level:
            if self.heading_text.strip():
                self.headings.append(DocumentHeading(
                    level=self.heading_level, text=self.heading_text.strip()
                ))
            self.heading_level = None
            self.parts.append("\n")
        if tag in {"p", "div", "li", "section", "article"}:
            self.parts.append("\n")
        if tag in {"th", "td"} and self.cell is not None:
            self.row.append(self.cell.strip())
            self.cell = None
        elif tag == "tr" and self.in_table and self.row:
            self.rows.append(self.row)
            self.row = []
        elif tag == "table" and self.in_table:
            if self.rows:
                self.tables.append(DocumentTable(headers=self.rows[0], rows=self.rows[1:]))
            self.in_table = False

    def handle_data(self, data: str) -> None:
        if self.ignored:
            return
        text = re.sub(r"\s+", " ", data)
        if self.in_title:
            self.title += text
            return
        if self.cell is not None:
            self.cell += text
        if self.heading_level:
            self.heading_text += text
        self.parts.append(text)


async def extract_text_source(
    request: ExtractionRequest, settings: Settings, mime: str
) -> NormalizedExtractionResponse:
    with tempfile.TemporaryDirectory(prefix="cte-text-") as scratch:
        path = await download_source(request.source_url, Path(scratch), settings, ".txt")
        content = await asyncio.to_thread(path.read_text, encoding="utf-8", errors="replace")
    title = Path(urlparse(request.source_url).path).name or "Web article"
    headings: list[DocumentHeading] = []
    tables: list[DocumentTable] = []
    if mime in {"text/html", "application/xhtml+xml"}:
        parser = ArticleParser()
        parser.feed(content)
        content = "\n\n".join(line.strip() for line in "".join(parser.parts).splitlines() if line.strip())
        title = parser.title.strip() or title
        headings, tables = parser.headings, parser.tables
    content = content.strip()
    if not content:
        raise SourceError("This source has no readable text. Paste the article text instead.")
    return NormalizedExtractionResponse(
        job_id=request.job_id, source_type="document", title=title,
        word_count=len(content.split()), content_markdown=content,
        headings=headings, tables=tables, metadata={"format": mime},
    )


def youtube_video_id(source_url: str) -> str | None:
    url = urlparse(source_url)
    if url.hostname not in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"}:
        return None
    if url.hostname in {"youtu.be", "www.youtu.be"}:
        candidate = url.path.strip("/").split("/")[0]
    elif url.path.startswith(("/shorts/", "/embed/", "/live/")):
        candidate = url.path.split("/")[2]
    else:
        candidate = parse_qs(url.query).get("v", [""])[0]
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
        raise SourceError("Use a link to one YouTube video with available captions")
    return candidate


def _fetch_youtube(video_id: str, job_id: str, max_bytes: int) -> NormalizedExtractionResponse:
    import requests
    from youtube_transcript_api import YouTubeTranscriptApi

    class TimedSession(requests.Session):
        def request(self, method, url, **kwargs):
            kwargs.setdefault("timeout", (10, 20))
            return super().request(method, url, **kwargs)

    try:
        with TimedSession() as session:
            transcripts = list(YouTubeTranscriptApi(http_client=session).list(video_id))
            if not transcripts:
                raise SourceError("This video does not have accessible captions")
            selected = next((item for item in transcripts if not item.is_generated), transcripts[0])
            transcript = selected.fetch()
    except Exception as exc:
        raise SourceError(
            "YouTube captions are unavailable. Paste a transcript or use a direct media URL."
        ) from exc
    text = "\n".join(item.text for item in transcript)
    if not text.strip() or len(text.encode("utf-8")) > max_bytes:
        raise SourceError("The transcript is empty or exceeds MAX_SOURCE_BYTES")
    return NormalizedExtractionResponse(
        job_id=job_id, source_type="video", title=f"YouTube video {video_id}",
        word_count=len(text.split()), content_markdown=text,
        timeline=[TimelineSegment(
            start_seconds=item.start, end_seconds=item.start + item.duration,
            text=item.text,
        ) for item in transcript if item.text.strip()],
        metadata={"format": "youtube_captions", "language": transcript.language_code},
    )


async def extract_youtube(
    video_id: str, request: ExtractionRequest, settings: Settings
) -> NormalizedExtractionResponse:
    try:
        async with asyncio.timeout(settings.source_timeout_seconds):
            return await asyncio.to_thread(_fetch_youtube, video_id, request.job_id, settings.max_source_bytes)
    except TimeoutError as exc:
        raise SourceError("YouTube caption retrieval timed out. Paste the transcript instead.") from exc
