from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class AdminFileRecord(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    source: Literal["upload", "url"]
    original_url: Optional[str] = None
    storage_path: str
    created_at: datetime
