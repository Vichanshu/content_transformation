"""Docling-backed document extraction and normalization."""

import asyncio
import multiprocessing
import re
import tempfile
from multiprocessing.connection import Connection, wait
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


def clean_text(value: str) -> str:
    """Remove unsafe controls while retaining Markdown line structure."""
    value = _CONTROL_CHARACTERS.sub("", value).replace("\r\n", "\n")
    return "\n".join(line.rstrip() for line in value.splitlines()).strip()


class DoclingExtractor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def extract(
        self, request: DocumentExtractionRequest
    ) -> NormalizedExtractionResponse:
        """Download to isolated scratch space and convert off the event loop."""
        with tempfile.TemporaryDirectory(prefix="cte-document-") as scratch:
            suffix = None
            if source_extension(request.source_url) not in {
                ".pdf", ".pptx", ".docx"
            }:
                mime = await source_mime_type(request.source_url, self.settings)
                suffix = {
                    "application/pdf": ".pdf",
                    "application/vnd.openxmlformats-officedocument"
                    ".presentationml.presentation": ".pptx",
                    "application/vnd.openxmlformats-officedocument"
                    ".wordprocessingml.document": ".docx",
                }.get(mime)
            path = await download_source(
                request.source_url, Path(scratch), self.settings, suffix
            )
            return await asyncio.to_thread(
                _convert_with_timeout,
                path,
                request,
                self.settings.docling_timeout_seconds,
            )

    @staticmethod
    def convert_local(
        path: Path, request: DocumentExtractionRequest
    ) -> NormalizedExtractionResponse:
        """Convert a local path, including one staged by another trusted caller."""
        from docling.document_converter import DocumentConverter

        result = DocumentConverter().convert(str(path))
        document = result.document
        markdown = clean_text(document.export_to_markdown())
        headings: list[DocumentHeading] = []
        for item, depth in document.iterate_items():
            label = str(getattr(item, "label", "")).lower()
            if "title" in label or "section_header" in label:
                heading_text = clean_text(str(getattr(item, "text", "")))
                if heading_text:
                    headings.append(
                        DocumentHeading(level=max(1, int(depth)), text=heading_text)
                    )

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
        title = next(
            (heading.text for heading in headings if heading.level == 1),
            None,
        ) or source_name or None
        return NormalizedExtractionResponse(
            job_id=request.job_id,
            source_type="document",
            title=title,
            word_count=len(markdown.split()),
            content_markdown=markdown,
            tables=tables,
            headings=headings,
            metadata={"source_name": source_name, "table_count": len(tables)},
        )


def _convert_child(
    path: str, request_json: str, connection: Connection
) -> None:
    try:
        request = DocumentExtractionRequest.model_validate_json(request_json)
        result = DoclingExtractor.convert_local(Path(path), request)
        connection.send(("ok", result.model_dump(mode="json")))
    except Exception as exc:
        connection.send(("error", f"{type(exc).__name__}: {exc}"[:500]))
    finally:
        connection.close()


def _convert_with_timeout(
    path: Path, request: DocumentExtractionRequest, timeout_seconds: int
) -> NormalizedExtractionResponse:
    """Run heavyweight Docling work in a killable child process."""
    context = multiprocessing.get_context("spawn")
    receiver, sender = context.Pipe(duplex=False)
    process = context.Process(
        target=_convert_child,
        args=(str(path), request.model_dump_json(), sender),
        daemon=False,
    )
    process.start()
    sender.close()
    try:
        ready = wait([receiver, process.sentinel], timeout_seconds)
        if receiver not in ready and process.sentinel in ready:
            raise RuntimeError("Docling process exited without a result")
        if receiver not in ready:
            raise TimeoutError("Docling conversion timed out")
        try:
            status, payload = receiver.recv()
        except EOFError as exc:
            raise RuntimeError("Docling process exited without a result") from exc
        process.join(timeout=5)
        if status != "ok":
            raise RuntimeError(f"Docling conversion failed: {payload}")
        return NormalizedExtractionResponse.model_validate(payload)
    finally:
        receiver.close()
        if process.is_alive():
            process.terminate()
        process.join(timeout=5)
        if process.is_alive():
            process.kill()
            process.join(timeout=5)
