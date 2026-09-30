"""Unify document, media, article, and caption extraction into one payload."""

import re

from app.schemas.payload import NormalizedExtractionResponse


def normalize_context(payload: NormalizedExtractionResponse) -> NormalizedExtractionResponse:
    """Clean text and enforce one stable payload shape for downstream routing."""
    content = re.sub(r"\n{3,}", "\n\n", payload.content_markdown.replace("\r\n", "\n")).strip()
    timeline = sorted(payload.timeline, key=lambda segment: segment.start_seconds)
    headings = [heading for heading in payload.headings if heading.text.strip()]
    return payload.model_copy(
        update={
            "content_markdown": content,
            "word_count": len(content.split()),
            "timeline": timeline,
            "headings": headings,
            "metadata": {**payload.metadata, "normalized": True},
        }
    )
