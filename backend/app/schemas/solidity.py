from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SolidityScanRequest(BaseModel):
    """Request body for starting a Solidity scan."""

    mode: Literal["quick", "standard"] = Field(
        default="standard",
        description="Scan mode: 'quick' for pattern-only, 'standard' for pattern + slither",
        examples=["standard"],
    )


class SolidityFinding(BaseModel):
    """A single vulnerability finding from SolidityGuard."""

    id: str
    title: str
    severity: str
    confidence: float
    file: str
    line: int
    code_snippet: str
    description: str
    remediation: str
    category: str
    swc: Optional[str] = None
    tool: str = "pattern-scanner"


class SeverityCounts(BaseModel):
    """Severity breakdown of findings."""

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    informational: int = 0
    total: int = 0


class SolidityUploadResponse(BaseModel):
    """Response after uploading a .sol file and starting a scan."""

    contract_id: str = Field(
        ...,
        description="UUID of the stored contract",
        examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    )
    scan_id: str = Field(
        ...,
        description="UUID of the scan in our database",
    )
    guard_audit_id: str = Field(
        ...,
        description="Audit ID from SolidityGuard (used for polling)",
    )
    filename: str
    size: int
    mode: Literal["quick", "standard"]
    status: str = Field(
        ...,
        description="Scan status: pending, running, complete, failed",
    )


class SolidityScanStatus(BaseModel):
    """Current status of a Solidity scan."""

    scan_id: str
    contract_id: str
    guard_audit_id: str
    mode: str
    status: str
    phase: int = 0
    total_phases: int = 7
    phase_name: str = ""
    progress: float = 0.0
    score: Optional[int] = None
    severity_counts: SeverityCounts = Field(default_factory=SeverityCounts)
    created_at: datetime
    completed_at: Optional[datetime] = None


class SolidityScanReport(BaseModel):
    """Full scan report with findings."""

    scan_id: str
    contract_id: str
    filename: str
    mode: str
    status: str
    score: Optional[int] = None
    severity_counts: SeverityCounts = Field(default_factory=SeverityCounts)
    findings: list[SolidityFinding] = Field(default_factory=list)
    report_markdown: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class SolidityScanRecord(BaseModel):
    """Summary record for listing scans."""

    scan_id: str
    contract_id: str
    filename: str
    mode: str
    status: str
    score: Optional[int] = None
    severity_counts: SeverityCounts = Field(default_factory=SeverityCounts)
    created_at: datetime


class PatternInfo(BaseModel):
    """A SolidityGuard vulnerability pattern."""

    id: str
    title: str
    severity: str
    category: str
    swc: Optional[str] = None
    description: str
