from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import shutil
import os

from app import analysis

router = APIRouter()


@router.post("/api/scan")
async def scan_file(file: UploadFile = File(...)):
    # Allowed file types / names
    allowed_endings = (
        ".dockerfile",
        ".dockerignore",
        ".yml",
        ".yaml",
        ".json",
        ".toml",
        ".conf",
        ".cfg",
        ".env",
        ".properties",
        ".k8s",
        ".nginx",
        ".txt",
        ".md",
    )

    filename = (file.filename or "").lower()

    # Accept 'Dockerfile' (no extension) as well
    if not (filename.endswith(allowed_endings) or filename == "dockerfile"):
        raise HTTPException(status_code=400, detail=f"File type not allowed: {file.filename}")

    # Save to temp file
    try:
        # Use suffix derived from filename when possible
        suffix = os.path.splitext(file.filename)[1] or None
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            content = await file.read()
            tmp.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")

    try:
        result = analysis.scan_malware(tmp_path)
        return JSONResponse(content=result)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
