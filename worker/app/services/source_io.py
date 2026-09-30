"""Bounded downloads for public HTTPS text sources."""

import asyncio
import ipaddress
import mimetypes
import socket
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from app.core.config import Settings


class SourceError(Exception):
    """An invalid or unavailable input asset."""


def _check_public_host(host: str) -> None:
    try:
        addresses = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise SourceError("Source hostname could not be resolved") from exc
    if not addresses:
        raise SourceError("Source hostname could not be resolved")
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise SourceError("Source hostname resolves to a non-public address")


def source_extension(source_url: str) -> str:
    return Path(unquote(urlparse(source_url).path)).suffix.lower()


async def source_mime_type(source_url: str, settings: Settings) -> str | None:
    """Infer type from extension, falling back to an HTTPS HEAD response."""
    mime, _ = mimetypes.guess_type(urlparse(source_url).path)
    supported_mimes = {
        "text/plain", "text/markdown", "text/html", "application/xhtml+xml",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "video/mp4", "video/quicktime",
        "audio/mpeg", "audio/wav", "audio/x-wav",
    }
    if mime in supported_mimes:
        return mime
    parsed = urlparse(source_url)
    await asyncio.to_thread(_check_public_host, parsed.hostname or "")
    try:
        async with httpx.AsyncClient(
            timeout=settings.source_timeout_seconds, follow_redirects=False
        ) as client:
            response = await client.head(source_url)
            response.raise_for_status()
            return response.headers.get("content-type", "").split(";", 1)[0].lower()
    except httpx.HTTPError as exc:
        raise SourceError("Unable to determine source media type") from exc


async def download_source(
    source_url: str, directory: Path, settings: Settings, suffix: str | None = None
) -> Path:
    """Download once into caller-owned scratch space with a hard byte limit."""
    parsed = urlparse(source_url)
    extension = suffix or source_extension(source_url)
    destination = directory / f"source{extension}"
    await asyncio.to_thread(_check_public_host, parsed.hostname or "")
    try:
        async with asyncio.timeout(settings.source_timeout_seconds):
            async with httpx.AsyncClient(
                timeout=settings.source_timeout_seconds, follow_redirects=False
            ) as client:
                async with client.stream("GET", source_url) as response:
                    response.raise_for_status()
                    content_length = int(response.headers.get("content-length", "0"))
                    if content_length > settings.max_source_bytes:
                        raise SourceError("Source exceeds MAX_SOURCE_BYTES")
                    size = 0
                    with destination.open("wb") as output:
                        async for chunk in response.aiter_bytes():
                            size += len(chunk)
                            if size > settings.max_source_bytes:
                                raise SourceError("Source exceeds MAX_SOURCE_BYTES")
                            output.write(chunk)
    except TimeoutError as exc:
        raise SourceError("Source download timed out") from exc
    except httpx.HTTPError as exc:
        raise SourceError("Source download failed") from exc
    if not destination.exists() or destination.stat().st_size == 0:
        raise SourceError("Source is empty")
    return destination
