"""
ici on va gerer la validation et sotrage de fichier dans le redis

on a de place different pour chaque fichier 
    - "file:{file_id}:metadata" → JSON with file info
    - "file:{file_id}:content"  → Base64-encoded file content
"""

import base64
import string
import uuid
from datetime import datetime, timezone
from typing import Optional

from redis import asyncio as aioredis

from app.core.config import settings
from app.schemas.filesupload import FileMetadata

# common error responses defined
class FileServiceError(Exception):
    """Base exception for file service errors.""" # <-- this is docstring, we gonna use a lot of them to keep our documentation updated. (gonna be visible if hovered over FileTooLargeError anywhere in code + in our /docs API docs)
    pass


class FileTooLargeError(FileServiceError): # http 413 (payload too large)
    """Raised when file exceeds size limit."""
    pass


class InvalidFileTypeError(FileServiceError): #http 400 (bad request)
    """Raised when file type is not allowed."""
    pass


class FileNotFoundError(FileServiceError): # http 404 (not found)
    """Raised when file doesn't exist in Redis."""
    pass


def get_file_extension(filename: str) -> str:
    """
    Extract file extension from filename.
    
    Examples:
        "docker-compose.yml" → ".yml"
        "Dockerfile" → "" (no extension)
        "config.tar.gz" → ".gz"
    """
    if "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def is_dockerfile(filename: str) -> bool:
    """
    Check if file is a Dockerfile (special case - no extension).
    Valid examples : "Dockerfile" "Dockerfile.dev" "Dockerfile.production"
    """
    basename = filename.split("/")[-1]  # Handle paths like "docker/Dockerfile"
    return basename == "Dockerfile" or basename.startswith("Dockerfile.")


def validate_file(
    filename: str,
    content_type: str,
    size: int,
    *,
    content: bytes | None = None,
) -> None:
    """
    Validate file against all rules. Raises exception if invalid.
    
    Checks:
        1. File size <= 20MB
        2. Extension in allowlist OR is Dockerfile
        3. MIME type in allowlist
        
    Raises:
        FileTooLargeError: If file exceeds size limit
        InvalidFileTypeError: If extension or MIME type not allowed
    """
    # file size 
    if size > settings.max_file_size_bytes:
        raise FileTooLargeError(
            f"File size ({size / 1024 / 1024:.1f}MB) exceeds "
            f"maximum allowed ({settings.max_file_size_mb}MB)"
        )
    
    # whitelist extension type check 
    extension = get_file_extension(filename)
    if not is_dockerfile(filename) and extension not in settings.allowed_extensions:
        raise InvalidFileTypeError(
            f"File type '{extension or 'no extension'}' is not allowed. "
            f"Allowed types: {', '.join(sorted(settings.allowed_extensions))}"
        )
    
    # safe mime type check
    if content_type not in settings.allowed_mime_types:
        raise InvalidFileTypeError(
            f"MIME type '{content_type}' is not allowed"
        )

    if content is not None and not _is_probably_text(content):
        raise InvalidFileTypeError(
            "File content does not look like text; binary payloads are not allowed"
        )


_PRINTABLE = set(string.printable.encode("ascii"))


def _is_probably_text(content: bytes) -> bool:
    """Heuristic check to reject obvious binary uploads.

    This is defense-in-depth, meant to prevent cases like `evil.exe` renamed to `.yml`.
    """
    if not content:
        return True

    # NUL bytes are a strong indicator of binary content.
    if b"\x00" in content:
        return False

    sample = content[:8192]
    # Count disallowed control characters (excluding \t, \n, \r).
    control_count = 0
    for b in sample:
        if b in (9, 10, 13):  # tab / lf / cr
            continue
        if b < 32 or b == 127:
            control_count += 1
    if control_count / max(len(sample), 1) > 0.02:
        return False

    # If it's mostly ASCII-printable or high-bit unicode bytes, treat as text.
    # This avoids falsely rejecting UTF-8 content.
    ascii_printable = 0
    for b in sample:
        if b in _PRINTABLE or b >= 128:
            ascii_printable += 1
    return ascii_printable / max(len(sample), 1) > 0.85

# redis part

def generate_file_id() -> str:
    """Generate unique file ID using UUID4."""
    return str(uuid.uuid4())


async def store_file(
    redis: aioredis.Redis,
    filename: str,
    content: bytes,
    content_type: str,
    source: str,
    original_url: Optional[str] = None,
    file_id: Optional[str] = None,
) -> FileMetadata:
    """
    Store file in Redis.
    
    Creates two keys:
        - file:{id}:metadata → JSON metadata
        - file:{id}:content  → Base64 content
    
    Args:
        redis: Redis connection
        filename: Original filename
        content: Raw file bytes
        content_type: MIME type
        source: "upload" or "url"
        original_url: Source URL if fetched from web
        
    Returns:
        FileMetadata object with all file info
    """
    file_id = file_id or generate_file_id()
    now = datetime.now(timezone.utc)
    
    # create metadata object (validate data by pydantic config defined in schemas)
    metadata = FileMetadata(
        file_id=file_id,
        filename=filename,
        size=len(content),
        content_type=content_type,
        source=source,
        original_url=original_url,
        uploaded_at=now
    )
    
    # chiffre content as base64 for safe storage 
    content_base64 = base64.b64encode(content).decode("utf-8")
    
    # store in Redis (using pipeline for data integrity, explained more in README)
    async with redis.pipeline() as pipe:
        # part1 metadata as json
        await pipe.set(
            f"file:{file_id}:metadata",
            metadata.model_dump_json()
        )
        # part2 content
        await pipe.set(
            f"file:{file_id}:content",
            content_base64
        )
        # send both parts
        await pipe.execute()
    
    return metadata


async def get_file_metadata(
    redis: aioredis.Redis,
    file_id: str
) -> FileMetadata:
    """
    Retrieve file metadata from Redis.
    
    Args:
        redis: Redis connection
        file_id: Unique file identifier
        
    Returns:
        FileMetadata object
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    data = await redis.get(f"file:{file_id}:metadata")
    
    if data is None:
        raise FileNotFoundError(f"File with ID '{file_id}' not found")
    
    return FileMetadata.model_validate_json(data)


async def get_file_content(
    redis: aioredis.Redis,
    file_id: str
) -> bytes:
    """
    Retrieve raw file content from Redis.
    
    Args:
        redis: Redis connection
        file_id: Unique file identifier
        
    Returns:
        Raw file bytes (decoded from base64)
        
    Raises:
        FileNotFoundError: If file doesn't exist
    """
    content_base64 = await redis.get(f"file:{file_id}:content")
    
    if content_base64 is None:
        raise FileNotFoundError(f"File with ID '{file_id}' not found")
    
    # dechiffrement from base64 back to bytes
    return base64.b64decode(content_base64)


async def delete_file(
    redis: aioredis.Redis,
    file_id: str
) -> bool:
    """
    Delete file from Redis.
    
    Args:
        redis: Redis connection
        file_id: Unique file identifier
        
    Returns:
        True if file was deleted, False if it didn't exist
    """
    # Delete both keys
    deleted_count = await redis.delete(
        f"file:{file_id}:metadata",
        f"file:{file_id}:content"
    )
    
    return deleted_count > 0


async def list_files(
    redis: aioredis.Redis,
    limit: int = 100
) -> list[FileMetadata]:
    """
    List all stored files (for debugging/admin).
    
    Args:
        redis: Redis connection
        limit: Maximum number of files to return
        
    Returns:
        List of FileMetadata objects
    """
    # parse all metadata keys
    keys = []
    async for key in redis.scan_iter(match="file:*:metadata", count=limit):
        keys.append(key)
        if len(keys) >= limit:
            break
    
    # fetch all metadata
    files = []
    for key in keys:
        data = await redis.get(key)
        if data:
            files.append(FileMetadata.model_validate_json(data))
    
    # sort by time (newest first)
    files.sort(key=lambda f: f.uploaded_at, reverse=True)
    
    return files
