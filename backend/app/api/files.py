"""
File Upload API Endpoints

Routes:
    POST   /upload      - Upload file via drag & drop
    POST   /from-url    - Fetch file from URL
    GET    /{file_id}   - Get file metadata
    GET    /{file_id}/content - Download file content
    DELETE /{file_id}   - Delete file
"""

import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse
from uuid import UUID
from fastapi import APIRouter, File, HTTPException, UploadFile, Depends, Request
from fastapi.responses import Response
from fastapi.responses import FileResponse
from redis import asyncio as aioredis

from app.core.config import settings
from app.db.postgres import get_db
from app.schemas.filesupload import (
    FileFromURLRequest,
    FileUploadResponse,
    FileMetadata,
    FileContentResponse,
    ImageScanRequest,
    ImageScanResponse,
    ErrorResponse,
)
from app.schemas.admin import AdminFileRecord
from app.services.db_service import (
    delete_file_record,
    get_file_storage_path,
    insert_file_record,
    insert_scan_result,
    list_file_records,
)
from app.services.file_service import (
    validate_file,
    store_file,
    get_file_metadata,
    get_file_content,
    delete_file,
    FileTooLargeError,
    InvalidFileTypeError,
    FileNotFoundError,
    generate_file_id,
)
from app.services.storage_service import build_storage_path, save_file_to_disk, delete_file_from_disk
from app.services.scan_service import run_trivy_scan, run_trivy_image_scan, build_scan_output_path
from app.services.url_fetch_service import RemoteFileTooLargeError, UnsafeFetchURLError, fetch_url_with_limit
from app.core.deps import get_optional_user, require_admin

# setup example @router.post("/upload") -> POST /api/files/upload
router = APIRouter(
    prefix="/api/files",
    tags=["files"],  # groups endpoints in /docs
)

_HEADER_BAD_CHARS_RE = re.compile(r"[\r\n\"]+")


def _safe_download_filename(name: str) -> str:
    safe = os.path.basename(name or "file")
    safe = _HEADER_BAD_CHARS_RE.sub("_", safe)
    return safe or "file"


async def _read_upload_file_with_limit(file: UploadFile, *, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise FileTooLargeError(
                f"File size exceeds maximum allowed ({settings.max_file_size_mb}MB)"
            )
        chunks.append(chunk)
    return b"".join(chunks)


def normalize_source_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path

    if host in {"github.com", "www.github.com"} and "/blob/" in path:
        parts = path.strip("/").split("/")
        if "blob" in parts:
            idx = parts.index("blob")
            if idx >= 2 and idx + 1 < len(parts):
                owner = parts[0]
                repo = parts[1]
                branch = parts[idx + 1]
                file_path = "/".join(parts[idx + 2 :])
                if file_path:
                    raw_path = f"/{owner}/{repo}/{branch}/{file_path}"
                    return urlunparse(("https", "raw.githubusercontent.com", raw_path, "", "", ""))

    if host.endswith("gitlab.com") and "/-/blob/" in path:
        parts = path.strip("/").split("/")
        if "blob" in parts:
            idx = parts.index("blob")
            if idx >= 1 and parts[idx - 1] == "-" and idx + 1 < len(parts):
                owner_repo = parts[: idx - 1]
                if len(owner_repo) >= 2:
                    branch = parts[idx + 1]
                    file_path = "/".join(parts[idx + 2 :])
                    if file_path:
                        raw_path = "/" + "/".join(owner_repo) + "/-/raw/" + branch + "/" + file_path
                        scheme = parsed.scheme or "https"
                        return urlunparse((scheme, parsed.netloc, raw_path, "", "", ""))

    return url

# apres pour propre code production il faut implementer le system de connexion automatic, serait moins de connect request -> more optimal
async def get_redis() -> aioredis.Redis:
    """
    This creates a new connection per request.
    """
    redis = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True
    )
    try:
        yield redis # open connect
    finally:
        await redis.close() # clean up connect

# drag&drop 
@router.post(
    "/upload",
    response_model=FileUploadResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid file type"},
        413: {"model": ErrorResponse, "description": "File too large"},
    },
    summary="Upload a file", 
    description="Upload a file via multipart form (drag & drop)",
)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    redis: aioredis.Redis = Depends(get_redis),
    db = Depends(get_db),
    user: dict | None = Depends(get_optional_user),
):
    """
    Upload a file via drag & drop or file picker.
    
    - Validates file extension against allowlist
    - Validates MIME type
    - Checks file size (max 20MB)
    - Stores in Redis with unique ID
    """
    try:
        # read file content (bounded) -> bytes
        content = await _read_upload_file_with_limit(
            file, max_bytes=settings.max_file_size_bytes
        )
    finally:
        await file.close()
    
    # validation
    try:
        validate_file( # check size, extension and MIME check
            filename=file.filename or "unknown", 
            content_type=file.content_type or "application/octet-stream",
            size=len(content),
            content=content,
        )
    except FileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e)) #HTTPEception to stop exec imideatly + return error msg string as json
    except InvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    file_id = generate_file_id()
    storage_path = None
    metadata = None
    scan_summary = None
    try:
        storage_path = save_file_to_disk(file_id, file.filename or "unknown", content)
        metadata = await store_file(
            redis=redis,
            filename=file.filename or "unknown",
            content=content,
            content_type=file.content_type or "application/octet-stream",
            source="upload",
            file_id=file_id,
        )
        owner_id = user["id"] if user else None
        await insert_file_record(db, metadata, storage_path, owner_id=owner_id)
        try:
            scan_summary, output_path, scan_status, scan_created_at = await run_trivy_scan(
                file_id,
                storage_path,
            )
            await insert_scan_result(
                db,
                file_id=file_id,
                scanner="trivy",
                status=scan_status,
                summary=scan_summary,
                raw_output_path=output_path,
                created_at=scan_created_at,
            )
        except Exception as exc:
            output_path = build_scan_output_path(file_id)
            scan_summary = {
                "status": "failed",
                "total": 0,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "unknown": 0,
                "error": str(exc),
            }
            try:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "w", encoding="utf-8") as handle:
                    json.dump({"error": str(exc)}, handle)
                await insert_scan_result(
                    db,
                    file_id=file_id,
                    scanner="trivy",
                    status="failed",
                    summary=scan_summary,
                    raw_output_path=output_path,
                    created_at=datetime.now(timezone.utc),
                )
            except Exception:
                pass
    except Exception as exc:
        if metadata is not None:
            await delete_file(redis, metadata.file_id)
        delete_file_from_disk(storage_path)
        raise HTTPException(status_code=500, detail=f"Failed to store file: {exc}")
    
    return FileUploadResponse(
        file_id=metadata.file_id,
        filename=metadata.filename,
        size=metadata.size,
        content_type=metadata.content_type,
        source=metadata.source,
        uploaded_at=metadata.uploaded_at,
        scan_summary=scan_summary,
        scan_report_url=str(request.url_for("get_scan_report", file_id=metadata.file_id)),
    )

# url upload
@router.post(
    "/from-url",
    response_model=FileUploadResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid file type or URL"},
        413: {"model": ErrorResponse, "description": "File too large"},
        502: {"model": ErrorResponse, "description": "Failed to fetch from URL"},
    },
    summary="Upload from URL",
    description="Fetch a file from a URL and store it",
)
async def upload_from_url(
    request: Request,
    payload: FileFromURLRequest,
    redis: aioredis.Redis = Depends(get_redis),
    db = Depends(get_db),
    user: dict | None = Depends(get_optional_user),
):
    """
    Fetch a file from a URL and store it.
    
    - Downloads file from provided URL
    - Validates file extension and MIME type
    - Checks file size (max 20MB)
    - Stores in Redis with unique ID
    """
    original_url = str(payload.url)
    fetch_url = normalize_source_url(original_url)
    
    # fetch file from URL
    try:
        fetched = await fetch_url_with_limit(
            fetch_url,
            max_bytes=settings.max_file_size_bytes,
            timeout_seconds=30.0,
        )
    except UnsafeFetchURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RemoteFileTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}")
    
    # extract filename from final URL (after redirects)
    final_url = fetched.url
    filename = urlparse(final_url).path.split("/")[-1]  # basename
    if not filename:
        filename = "downloaded_file"
    
    # get content type from response headers
    content_type = fetched.content_type
    content = fetched.content
    
    # validation
    try:
        validate_file(
            filename=filename,
            content_type=content_type,
            size=len(content),
            content=content,
        )
    except FileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except InvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    file_id = generate_file_id()
    storage_path = None
    metadata = None
    scan_summary = None
    try:
        storage_path = save_file_to_disk(file_id, filename, content)
        metadata = await store_file(
            redis=redis,
            filename=filename,
            content=content,
            content_type=content_type,
            source="url",
            original_url=original_url,
            file_id=file_id,
        )
        owner_id = user["id"] if user else None
        await insert_file_record(db, metadata, storage_path, owner_id=owner_id)
        try:
            scan_summary, output_path, scan_status, scan_created_at = await run_trivy_scan(
                file_id,
                storage_path,
            )
            await insert_scan_result(
                db,
                file_id=file_id,
                scanner="trivy",
                status=scan_status,
                summary=scan_summary,
                raw_output_path=output_path,
                created_at=scan_created_at,
            )
        except Exception as exc:
            output_path = build_scan_output_path(file_id)
            scan_summary = {
                "status": "failed",
                "total": 0,
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "unknown": 0,
                "error": str(exc),
            }
            try:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "w", encoding="utf-8") as handle:
                    json.dump({"error": str(exc)}, handle)
                await insert_scan_result(
                    db,
                    file_id=file_id,
                    scanner="trivy",
                    status="failed",
                    summary=scan_summary,
                    raw_output_path=output_path,
                    created_at=datetime.now(timezone.utc),
                )
            except Exception:
                pass
    except Exception as exc:
        if metadata is not None:
            await delete_file(redis, metadata.file_id)
        delete_file_from_disk(storage_path)
        raise HTTPException(status_code=500, detail=f"Failed to store file: {exc}")
    
    return FileUploadResponse(
        file_id=metadata.file_id,
        filename=metadata.filename,
        size=metadata.size,
        content_type=metadata.content_type,
        source=metadata.source,
        uploaded_at=metadata.uploaded_at,
        scan_summary=scan_summary,
        scan_report_url=str(request.url_for("get_scan_report", file_id=metadata.file_id)),
    )

# get metadata
@router.get(
    "/{file_id}",
    response_model=FileMetadata,
    responses={
        404: {"model": ErrorResponse, "description": "File not found"},
    },
    summary="Get file metadata",
    description="Retrieve metadata about a stored file",
)
async def get_file_info(
    file_id: UUID,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Get metadata for a stored file."""
    try:
        return await get_file_metadata(redis, str(file_id))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

# get content
@router.get(
    "/{file_id}/content",
    responses={
        200: {
            "content": {"application/octet-stream": {}},
            "description": "File content as binary download",
        },
        404: {"model": ErrorResponse, "description": "File not found"},
    },
    summary="Download file content",
    description="Download the actual file content",
)
async def download_file(
    file_id: UUID,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Download file content as binary."""
    try:
        file_id_str = str(file_id)
        metadata = await get_file_metadata(redis, file_id_str)
        content = await get_file_content(redis, file_id_str)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Return as downloadable file
    safe_filename = _safe_download_filename(metadata.filename)
    return Response(
        content=content,
        media_type=metadata.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"'
        }
    )


@router.delete(
    "/{file_id}",
    responses={
        200: {"description": "File deleted successfully"},
        404: {"model": ErrorResponse, "description": "File not found"},
    },
    summary="Delete a file",
    description="Remove a file from storage",
)
async def delete_stored_file(
    file_id: UUID,
    redis: aioredis.Redis = Depends(get_redis),
    db = Depends(get_db),
):
    """Delete a file from Redis, disk storage, and Postgres."""
    file_id_str = str(file_id)

    storage_path = await get_file_storage_path(db, file_id_str)
    if not storage_path:
        try:
            metadata = await get_file_metadata(redis, file_id_str)
            storage_path = build_storage_path(file_id_str, metadata.filename)
        except FileNotFoundError:
            storage_path = None

    deleted_redis = await delete_file(redis, file_id_str)
    deleted_db = await delete_file_record(db, file_id_str)

    deleted_disk = False
    if storage_path:
        delete_file_from_disk(storage_path)
        deleted_disk = True

    scan_path = build_scan_output_path(file_id_str)
    try:
        os.remove(scan_path)
    except FileNotFoundError:
        pass

    if not deleted_redis and not deleted_db and not storage_path:
        raise HTTPException(status_code=404, detail=f"File '{file_id_str}' not found")

    return {
        "message": "File deleted successfully",
        "file_id": file_id_str,
        "deleted_redis": bool(deleted_redis),
        "deleted_db": bool(deleted_db),
        "deleted_disk": bool(deleted_disk),
    }


@router.get(
    "/{file_id}/scan",
    name="get_scan_report",
    responses={
        200: {
            "content": {"application/json": {}},
            "description": "Trivy scan JSON report",
        },
        404: {"model": ErrorResponse, "description": "Scan report not found"},
    },
    summary="Download scan report",
    description="Download the raw Trivy scan JSON for a file",
)
async def get_scan_report(file_id: UUID):
    path = build_scan_output_path(str(file_id))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Scan report not found")
    return FileResponse(path, media_type="application/json")


@router.post(
    "/scan-image",
    response_model=ImageScanResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image reference"},
        502: {"model": ErrorResponse, "description": "Failed to scan image"},
    },
    summary="Scan container image",
    description="Run Trivy image scan for a container image reference",
)
async def scan_image(
    request: Request,
    payload: ImageScanRequest,
):
    image_ref = payload.image.strip()
    if not image_ref:
        raise HTTPException(status_code=400, detail="Image reference is required")

    scan_id = generate_file_id()
    try:
        scan_summary, _output_path, _status, _created_at = await run_trivy_image_scan(
            image_ref,
            scan_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to scan image: {exc}")

    return ImageScanResponse(
        image=image_ref,
        scan_summary=scan_summary,
        scan_report_url=str(request.url_for("get_scan_report", file_id=scan_id)),
    )


@router.get(
    "/admin/files",
    response_model=list[AdminFileRecord],
    summary="List stored files (admin)",
    description="Return recent file records from Postgres",
)
async def list_admin_files(
    request: Request,
    limit: int = 50,
    db=Depends(get_db),
    _admin=Depends(require_admin),
):
    limit = max(1, min(int(limit), 200))
    records = await list_file_records(db, limit=limit)
    for record in records:
        record.scan_report_url = str(request.url_for("get_scan_report", file_id=record.id))
    return records
