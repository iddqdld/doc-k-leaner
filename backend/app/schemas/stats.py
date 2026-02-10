from pydantic import BaseModel


class AuditStats(BaseModel):
    total_files: int
    total_scans: int
    critical: int
    high: int
    medium: int
    low: int
