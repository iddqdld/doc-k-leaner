from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.filesupload import ScanSummary


class AdminFileRecord(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    source: Literal["upload", "url"]
    original_url: Optional[str] = None
    storage_path: str
    created_at: datetime
    scan_status: Optional[str] = None
    scan_summary: Optional[ScanSummary] = None
    scan_report_url: Optional[str] = None
