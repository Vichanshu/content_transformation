"""Local Docling extraction for PDF, DOCX, and PPTX sources."""

import asyncio
import re
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

from app.core.config import Settings
from app.schemas.payload import (
    DocumentExtractionRequest,
    DocumentHeading,
    DocumentTable,
    NormalizedExtractionResponse,
)
from app.services.source_io import download_source, source_extension, source_mime_type

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_DOCUMENT_EXTENSIONS = {".pdf", ".pptx", ".docx"}
_DOCUMENT_SUFFIXES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def clean_text(value: str) -> str:
    return "\n".join(
        line.rstrip()
        for line in _CONTROL_CHARACTERS.sub("", value).replace("\r\n", "\n").splitlines()
    ).strip()


class DoclingExtractor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def extract(
        self, request: DocumentExtractionRequest
    ) -> NormalizedExtractionResponse:
        suffix = source_extension(request.source_url)
        if suffix not in _DOCUMENT_EXTENSIONS:
            mime = await source_mime_type(request.source_url, self.settings)
            suffix = _DOCUMENT_SUFFIXES.get(mime or "", "")
        if not suffix:
            raise ValueError("Unsupported document type")
        with tempfile.TemporaryDirectory(prefix="cte-document-") as scratch:
            path = await download_source(
                request.source_url, Path(scratch), self.settings, suffix
            )
            try:
                async with asyncio.timeout(self.settings.docling_timeout_seconds):
                    return await asyncio.to_thread(self.convert_local, path, request)
            except TimeoutError as exc:
                raise RuntimeError("Docling conversion timed out") from exc

    @staticmethod
    def convert_local(
        path: Path, request: DocumentExtractionRequest
    ) -> NormalizedExtractionResponse:
        from docling.document_converter import DocumentConverter

        document = DocumentConverter().convert(str(path)).document
        markdown = clean_text(document.export_to_markdown())
        headings: list[DocumentHeading] = []
        for item, depth in document.iterate_items():
            label = str(getattr(item, "label", "")).lower()
            if "title" in label or "section_header" in label:
                text = clean_text(str(getattr(item, "text", "")))
                if text:
                    headings.append(DocumentHeading(level=max(1, int(depth)), text=text))

        tables: list[DocumentTable] = []
        for table in document.tables:
            frame = table.export_to_dataframe(doc=document).fillna("")
            tables.append(
                DocumentTable(
                    caption=clean_text(table.caption_text(doc=document)) or None,
                    headers=[clean_text(str(value)) for value in frame.columns],
                    rows=[
                        [clean_text(str(value)) for value in row]
                        for row in frame.itertuples(index=False, name=None)
                    ],
                )
            )
        if not markdown and not tables:
            raise RuntimeError("Docling produced no extractable content")
        source_name = Path(unquote(urlparse(request.source_url).path)).name
        title = next((item.text for item in headings if item.level == 1), None)
        return NormalizedExtractionResponse(
            job_id=request.job_id,
            source_type="document",
            title=title or source_name or None,
            word_count=len(markdown.split()),
            content_markdown=markdown,
            headings=headings,
            tables=tables,
            metadata={"extractor": "docling", "source_name": source_name},
        )
