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


class SolidityOverview(BaseModel):
    total_contracts: int
    total_scans: int
    completed_scans: int
    avg_score: float | None
    critical: int
    high: int
    medium: int
    low: int
    informational: int


class SolidityDailyScans(BaseModel):
    date: str
    count: int


class GlobalOverview(BaseModel):
    total_files: int
    total_size_bytes: int
    sandbox_lines: int
