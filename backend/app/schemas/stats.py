from pydantic import BaseModel


class AuditStats(BaseModel):
    total_files: int
    total_scans: int
    critical: int
    high: int
    medium: int
    low: int


class DailyScans(BaseModel):
    date: str
    count: int


class DailySeverity(BaseModel):
    date: str
    critical: int
    high: int
    medium: int
    low: int


class FileTypeCount(BaseModel):
    file_type: str
    count: int


class SourceCount(BaseModel):
    source: str
    count: int
