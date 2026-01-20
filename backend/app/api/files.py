"""
File Upload API Endpoints

Routes:
    POST   /upload      - Upload file via drag & drop
    POST   /from-url    - Fetch file from URL
    GET    /{file_id}   - Get file metadata
    GET    /{file_id}/content - Download file content
    DELETE /{file_id}   - Delete file
"""

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile, Depends
from fastapi.responses import Response
from redis import asyncio as aioredis

from app.core.config import settings
from app.schemas.filesupload import (
    FileFromURLRequest,
    FileUploadResponse,
    FileMetadata,
    FileContentResponse,
    ErrorResponse,
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
)
import json
from app import trivy_scan

# setup example @router.post("/upload") -> POST /api/files/upload
router = APIRouter(
    prefix="/api/files",
    tags=["files"],  # groups endpoints in /docs
)

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
    file: UploadFile = File(...), # multipart parsing by fastapi eg returns orginal filename docker-compose.yaml
    redis: aioredis.Redis = Depends(get_redis), # depends to call get_redis() before the function and cleanup (finally:) after function returns
):
    """
    Upload a file via drag & drop or file picker.
    
    - Validates file extension against allowlist
    - Validates MIME type
    - Checks file size (max 20MB)
    - Stores in Redis with unique ID
    """
    # read file content get bytes
    content = await file.read()
    
    # validation
    try:
        validate_file( # check size, extension and MIME check
            filename=file.filename or "unknown", 
            content_type=file.content_type or "application/octet-stream",
            size=len(content)
        )
    except FileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e)) #HTTPEception to stop exec imideatly + return error msg string as json
    except InvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # store in Redis
    metadata = await store_file(
        redis=redis,
        filename=file.filename or "unknown",
        content=content,
        content_type=file.content_type or "application/octet-stream",
        source="upload",
    )

    # Try to run Trivy scan on uploaded file (if supported)
    try:
        scan_result = trivy_scan.run_trivy_on_bytes(content, metadata.filename)
        if scan_result is not None:
            # store raw trivy JSON under a separate key
            await redis.set(f"file:{metadata.file_id}:trivy", json.dumps(scan_result))
    except Exception:
        # Do not fail upload if scanning fails; just log to stdout for now
        try:
            print("Trivy scan failed for uploaded file", metadata.filename)
        except Exception:
            pass
    
    # return response
    return FileUploadResponse(
        file_id=metadata.file_id,
        filename=metadata.filename,
        size=metadata.size,
        content_type=metadata.content_type,
        source=metadata.source,
        uploaded_at=metadata.uploaded_at,
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
    request: FileFromURLRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    """
    Fetch a file from a URL and store it.
    
    - Downloads file from provided URL
    - Validates file extension and MIME type
    - Checks file size (max 20MB)
    - Stores in Redis with unique ID
    """
    url = str(request.url)
    
    # fetch file from URL
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                follow_redirects=True,
                timeout=30.0,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e: 
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch URL: HTTP {e.response.status_code}" # server respond with error
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch URL: {str(e)}" # couldn't reach server
        )
    
    # extract filename from URL
    filename = url.split("/")[-1].split("?")[0]  # Remove query params
    if not filename:
        filename = "downloaded_file"
    
    # get content type from response headers
    content_type = response.headers.get("content-type", "application/octet-stream")
    # remove charset if present (e.g., "text/yaml; charset=utf-8" → "text/yaml")
    content_type = content_type.split(";")[0].strip()
    
    content = response.content
    
    # validation
    try:
        validate_file(
            filename=filename,
            content_type=content_type,
            size=len(content)
        )
    except FileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except InvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # store in Redis
    metadata = await store_file(
        redis=redis,
        filename=filename,
        content=content,
        content_type=content_type,
        source="url",
        original_url=url,
    )
    
    return FileUploadResponse(
        file_id=metadata.file_id,
        filename=metadata.filename,
        size=metadata.size,
        content_type=metadata.content_type,
        source=metadata.source,
        uploaded_at=metadata.uploaded_at,
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
    file_id: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Get metadata for a stored file."""
    try:
        return await get_file_metadata(redis, file_id)
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
    file_id: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Download file content as binary."""
    try:
        metadata = await get_file_metadata(redis, file_id)
        content = await get_file_content(redis, file_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Return as downloadable file
    return Response(
        content=content,
        media_type=metadata.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{metadata.filename}"'
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
    file_id: str,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Delete a file from Redis."""
    deleted = await delete_file(redis, file_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail=f"File '{file_id}' not found")
    
    return {"message": "File deleted successfully", "file_id": file_id}
