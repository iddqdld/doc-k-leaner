from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, HttpUrl, Field


class ScanSummary(BaseModel):
    status: str
    total: int
    critical: int
    high: int
    medium: int
    low: int
    unknown: int
    error: str | None = None

class FileFromURLRequest(BaseModel):
    """Request body for fetching a file from URL."""
    
    url: HttpUrl = Field( # <-- HttpUrl type from pedantic c un format specifique qui va requre valide URL format
        ..., # <-- pour dire que cette Field est obligatoire, sinon sans ca va donner le meme resultat, mais comme ca le code serait plus claire.
        description="URL to fetch the file from", # <-- tous descriptions seront visible dans notre docs pour api avec OpenAPI
        examples=["https://raw.githubusercontent.com/user/repo/main/docker-compose.yml"]
    )


class ImageScanRequest(BaseModel):
    """Request body for scanning a container image."""

    image: str = Field(
        ...,
        description="Container image reference (e.g., nginx:latest)",
        examples=["nginx:latest"]
    )

class FileUploadResponse(BaseModel):
    """Response after successful file upload."""
    
    file_id: str = Field(
        ...,
        description="Unique identifier for the uploaded file",
        examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"]
    )
    filename: str = Field(
        ...,
        description="Original filename",
        examples=["docker-compose.yml"]
    )
    size: int = Field(
        ...,
        description="File size in bytes",
        examples=[1024]
    )
    content_type: str = Field(
        ...,
        description="MIME type of the file",
        examples=["text/yaml"]
    )
    source: Literal["upload", "url"] = Field(
        ...,
        description="How the file was received"
    )
    uploaded_at: datetime = Field(
        ...,
        description="Timestamp when file was stored"
    )
    scan_summary: ScanSummary | None = Field(
        default=None,
        description="Trivy scan summary (if available)"
    )
    scan_report_url: str | None = Field(
        default=None,
        description="URL to the full scan JSON report"
    )


class ImageScanResponse(BaseModel):
    """Response after successful image scan."""

    image: str = Field(
        ...,
        description="Image reference scanned",
        examples=["nginx:latest"]
    )
    scan_summary: ScanSummary | None = Field(
        default=None,
        description="Trivy scan summary (if available)"
    )
    scan_report_url: str | None = Field(
        default=None,
        description="URL to the full scan JSON report"
    )


class FileMetadata(BaseModel):
    """Full file metadata (stored in Redis)."""
    
    file_id: str
    filename: str
    size: int
    content_type: str
    source: Literal["upload", "url"]
    original_url: Optional[str] = None  # set to None si upload via drag&drop eg source"upload" (str our None(default = None)!!!)
    uploaded_at: datetime
    # c just metadata de ficher resu, content of the file is stored separelty for easier access


class FileContentResponse(BaseModel):
    """Response when retrieving file content."""
    
    file_id: str
    filename: str
    content_type: str
    content: str = Field(
        ...,
        description="File content as base64-encoded string"
    )


class ErrorResponse(BaseModel):
    """Standard error response."""
    
    detail: str = Field(
        ...,
        description="Error message",
        examples=["File type .exe is not allowed"]
    )
