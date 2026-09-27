"""Validated contracts shared by all extraction endpoints."""

from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator


class ExtractionRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=128)
    source_url: str = Field(min_length=1)
    webhook_url: str | None = None

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"https", "s3"} or not parsed.hostname:
            raise ValueError("source_url must be an HTTPS or s3:// URL")
        if parsed.username or parsed.password:
            raise ValueError("source_url must not contain credentials")
        return value

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, value: str | None) -> str | None:
        if value is not None:
            parsed = urlparse(value)
            if parsed.scheme != "https" or not parsed.hostname:
                raise ValueError("webhook_url must be an HTTPS URL")
        return value


class DocumentExtractionRequest(ExtractionRequest):
    pass


class MediaExtractionRequest(ExtractionRequest):
    pass


class TimelineSegment(BaseModel):
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(ge=0)
    speaker: str | None = None
    text: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_time_range(self) -> "TimelineSegment":
        if self.end_seconds < self.start_seconds:
            raise ValueError("end_seconds must be at or after start_seconds")
        return self


class DocumentTable(BaseModel):
    caption: str | None = None
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)


class DocumentHeading(BaseModel):
    level: int = Field(ge=1)
    text: str = Field(min_length=1)


class NormalizedContent(BaseModel):
    source_type: Literal["document", "video", "audio", "hybrid"]
    title: str | None = None
    word_count: int = Field(ge=0)
    content_markdown: str
    tables: list[DocumentTable] = Field(default_factory=list)
    timeline: list[TimelineSegment] = Field(default_factory=list)
    headings: list[DocumentHeading] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class NormalizedExtractionResponse(NormalizedContent):
    job_id: str
