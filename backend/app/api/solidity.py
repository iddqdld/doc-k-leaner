"""
Solidity Scanner API Endpoints

Routes:
    POST   /upload           - Upload .sol file(s) and start a scan
    GET    /scans/{scan_id}  - Get scan status (poll for progress)
    GET    /scans/{scan_id}/report  - Get full report with findings
    GET    /scans/{scan_id}/pdf     - Download PDF report
    GET    /scans            - List all scans
    GET    /patterns         - List SolidityGuard vulnerability patterns
    GET    /health           - Check SolidityGuard availability
"""

import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from fastapi.responses import Response
from psycopg.types.json import Json

from app.core.config import settings
from app.db.postgres import get_db
from app.schemas.solidity import (
    PatternInfo,
    SeverityCounts,
    SolidityScanRecord,
    SolidityScanReport,
    SolidityScanStatus,
    SolidityUploadResponse,
)
from app.services import solidity_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/solidity",
    tags=["solidity"],
)

_MAX_SOL_BYTES = settings.solidity_max_file_size_mb * 1024 * 1024


def _validate_sol_file(filename: str, size: int) -> None:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.solidity_allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Only .sol files are allowed, got '{ext or 'no extension'}'",
        )
    if size > _MAX_SOL_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size / 1024 / 1024:.1f}MB). Max: {settings.solidity_max_file_size_mb}MB",
        )


@router.post(
    "/upload",
    response_model=SolidityUploadResponse,
    summary="Upload Solidity contract and scan",
    description="Upload one or more .sol files, start a SolidityGuard audit",
)
async def upload_and_scan(
    files: list[UploadFile] = File(...),
    mode: str = Form(default="standard"),
    db=Depends(get_db),
):
    if mode not in ("quick", "standard"):
        raise HTTPException(status_code=400, detail="Mode must be 'quick' or 'standard'")

    file_pairs: list[tuple[str, bytes]] = []
    first_filename = ""
    total_size = 0

    for f in files:
        fname = f.filename or "unknown.sol"
        try:
            content = await f.read()
        finally:
            await f.close()

        _validate_sol_file(fname, len(content))
        file_pairs.append((fname, content))
        total_size += len(content)
        if not first_filename:
            first_filename = fname

    contract_id = str(uuid.uuid4())
    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    os.makedirs(settings.solidity_storage_dir, exist_ok=True)
    contract_dir = os.path.join(settings.solidity_storage_dir, contract_id)
    os.makedirs(contract_dir, exist_ok=True)
    for fname, content in file_pairs:
        with open(os.path.join(contract_dir, fname), "wb") as fh:
            fh.write(content)

    async with db.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO solidity_contracts (id, filename, size, storage_path, created_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (contract_id, first_filename, total_size, contract_dir, now),
        )
    await db.commit()

    tools = ["pattern"] if mode == "quick" else ["pattern", "slither"]

    try:
        audit_result = await solidity_service.start_audit(
            files=file_pairs,
            mode=mode,
            tools=tools,
        )
    except Exception as exc:
        logger.error("SolidityGuard audit start failed: %s", exc)
        async with db.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO solidity_scans
                    (id, contract_id, guard_audit_id, mode, status, severity_counts, findings, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (scan_id, contract_id, "", mode, "failed", Json({}), Json([]), now),
            )
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail=f"SolidityGuard service error: {exc}",
        )

    guard_audit_id = audit_result.get("id", "")
    guard_status = audit_result.get("status", "pending")

    counts = audit_result.get("findings_count", {})
    async with db.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO solidity_scans
                (id, contract_id, guard_audit_id, mode, status, severity_counts, findings, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (scan_id, contract_id, guard_audit_id, mode, guard_status, Json(counts), Json([]), now),
        )
    await db.commit()

    return SolidityUploadResponse(
        contract_id=contract_id,
        scan_id=scan_id,
        guard_audit_id=guard_audit_id,
        filename=first_filename,
        size=total_size,
        mode=mode,
        status=guard_status,
    )


@router.get(
    "/scans/{scan_id}",
    response_model=SolidityScanStatus,
    summary="Get scan status",
    description="Poll for scan progress. Updates from SolidityGuard if still running.",
)
async def get_scan_status(scan_id: str, db=Depends(get_db)):
    async with db.cursor() as cur:
        await cur.execute(
            """
            SELECT s.id, s.contract_id, s.guard_audit_id, s.mode, s.status,
                   s.score, s.severity_counts, s.created_at, s.completed_at
            FROM solidity_scans s WHERE s.id = %s
            """,
            (scan_id,),
        )
        row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")

    db_status = row[4]
    guard_audit_id = row[2]

    if db_status in ("pending", "running") and guard_audit_id:
        try:
            live = await solidity_service.get_audit_status(guard_audit_id)
            live_status = live.get("status", db_status)
            live_counts = live.get("findings_count", {})

            completed_at = None
            score = None
            findings = []
            report_md = None

            if live_status == "complete":
                completed_at = datetime.now(timezone.utc)
                try:
                    report = await solidity_service.get_audit_report(guard_audit_id)
                    score = report.get("score")
                    findings = report.get("findings", [])
                    report_md = report.get("report_markdown")
                    live_counts = report.get("summary", live_counts)
                except Exception:
                    findings = await solidity_service.get_audit_findings(guard_audit_id)

            async with db.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE solidity_scans
                    SET status = %s, score = %s, severity_counts = %s,
                        findings = %s, report_markdown = %s, completed_at = %s
                    WHERE id = %s
                    """,
                    (
                        live_status, score, Json(live_counts),
                        Json(findings), report_md, completed_at,
                        scan_id,
                    ),
                )
            await db.commit()

            return SolidityScanStatus(
                scan_id=str(row[0]),
                contract_id=str(row[1]),
                guard_audit_id=guard_audit_id,
                mode=row[3],
                status=live_status,
                phase=live.get("phase", 0),
                total_phases=live.get("total_phases", 7),
                phase_name=live.get("phase_name", ""),
                progress=live.get("progress", 0.0),
                score=score or row[5],
                severity_counts=SeverityCounts(**(live_counts or {})),
                created_at=row[7],
                completed_at=completed_at or row[8],
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Failed to poll SolidityGuard for %s: %s", scan_id, exc)

    return SolidityScanStatus(
        scan_id=str(row[0]),
        contract_id=str(row[1]),
        guard_audit_id=str(row[2]),
        mode=row[3],
        status=db_status,
        score=row[5],
        severity_counts=SeverityCounts(**(row[6] or {})),
        created_at=row[7],
        completed_at=row[8],
    )


@router.get(
    "/scans/{scan_id}/report",
    response_model=SolidityScanReport,
    summary="Get full scan report",
    description="Returns findings, severity counts, score, and markdown report",
)
async def get_scan_report(scan_id: str, db=Depends(get_db)):
    async with db.cursor() as cur:
        await cur.execute(
            """
            SELECT s.id, s.contract_id, s.mode, s.status, s.score,
                   s.severity_counts, s.findings, s.report_markdown,
                   s.created_at, s.completed_at, c.filename
            FROM solidity_scans s
            JOIN solidity_contracts c ON c.id = s.contract_id
            WHERE s.id = %s
            """,
            (scan_id,),
        )
        row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")
    if row[3] != "complete":
        raise HTTPException(status_code=409, detail="Scan not yet complete")

    return SolidityScanReport(
        scan_id=str(row[0]),
        contract_id=str(row[1]),
        filename=row[10],
        mode=row[2],
        status=row[3],
        score=row[4],
        severity_counts=SeverityCounts(**(row[5] or {})),
        findings=row[6] or [],
        report_markdown=row[7],
        created_at=row[8],
        completed_at=row[9],
    )


@router.get(
    "/scans/{scan_id}/pdf",
    summary="Download PDF report",
    description="Download the audit report as a styled PDF",
)
async def get_scan_pdf(scan_id: str, db=Depends(get_db)):
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT guard_audit_id, status FROM solidity_scans WHERE id = %s",
            (scan_id,),
        )
        row = await cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")
    if row[1] != "complete":
        raise HTTPException(status_code=409, detail="Scan not yet complete")

    try:
        pdf_bytes = await solidity_service.get_audit_report_pdf(row[0])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PDF generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="solidity-audit-{scan_id[:8]}.pdf"'},
    )


@router.get(
    "/scans",
    response_model=list[SolidityScanRecord],
    summary="List all Solidity scans",
    description="Returns recent scans with severity summaries",
)
async def list_scans(limit: int = 50, db=Depends(get_db)):
    limit = max(1, min(limit, 200))
    async with db.cursor() as cur:
        await cur.execute(
            """
            SELECT s.id, s.contract_id, c.filename, s.mode, s.status,
                   s.score, s.severity_counts, s.created_at
            FROM solidity_scans s
            JOIN solidity_contracts c ON c.id = s.contract_id
            ORDER BY s.created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = await cur.fetchall()

    return [
        SolidityScanRecord(
            scan_id=str(r[0]),
            contract_id=str(r[1]),
            filename=r[2],
            mode=r[3],
            status=r[4],
            score=r[5],
            severity_counts=SeverityCounts(**(r[6] or {})),
            created_at=r[7],
        )
        for r in rows
    ]


@router.get(
    "/patterns",
    response_model=list[PatternInfo],
    summary="List vulnerability patterns",
    description="Returns all 104 SolidityGuard vulnerability patterns",
)
async def list_patterns(
    category: str | None = None,
    severity: str | None = None,
):
    try:
        return await solidity_service.list_patterns(category=category, severity=severity)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SolidityGuard unreachable: {exc}")


@router.get(
    "/health",
    summary="SolidityGuard health check",
)
async def health():
    reachable = await solidity_service.health_check()
    return {
        "solidityguard": "up" if reachable else "down",
        "url": settings.solidityguard_url,
    }
