from fastapi import APIRouter, Depends, Query

from app.db.postgres import get_db
from app.schemas.stats import (
    AuditStats, DailyScans, DailySeverity, FileTypeCount, SourceCount,
    SolidityOverview, SolidityDailyScans, GlobalOverview,
)
from app.services.db_service import (
    get_audit_stats,
    get_scans_over_time,
    get_severity_over_time,
    get_file_type_stats,
    get_source_stats,
    get_solidity_overview,
    get_solidity_scans_over_time,
    get_global_overview,
)


router = APIRouter(
    prefix="/api/stats",
    tags=["stats"],
)


@router.get(
    "/global",
    response_model=GlobalOverview,
    summary="Global platform overview",
)
async def global_overview(db=Depends(get_db)):
    return await get_global_overview(db)


@router.get(
    "/overview",
    response_model=AuditStats,
    summary="Audit stats overview",
    description="Return aggregate scan statistics from Postgres",
)
async def stats_overview(db=Depends(get_db)):
    return await get_audit_stats(db)


@router.get(
    "/scans-over-time",
    response_model=list[DailyScans],
    summary="Scans per day",
)
async def scans_over_time(
    days: int = Query(default=30, ge=1, le=90),
    offset: int = Query(default=0, ge=0, le=365),
    db=Depends(get_db),
):
    return await get_scans_over_time(db, days, offset)


@router.get(
    "/severity-over-time",
    response_model=list[DailySeverity],
    summary="Severity breakdown per day",
)
async def severity_over_time(
    days: int = Query(default=30, ge=1, le=90),
    offset: int = Query(default=0, ge=0, le=365),
    db=Depends(get_db),
):
    return await get_severity_over_time(db, days, offset)


@router.get(
    "/by-file-type",
    response_model=list[FileTypeCount],
    summary="File count by extension",
)
async def by_file_type(db=Depends(get_db)):
    return await get_file_type_stats(db)


@router.get(
    "/by-source",
    response_model=list[SourceCount],
    summary="File count by upload source",
)
async def by_source(db=Depends(get_db)):
    return await get_source_stats(db)


@router.get(
    "/solidity/overview",
    response_model=SolidityOverview,
    summary="Solidity scan stats overview",
)
async def solidity_overview(db=Depends(get_db)):
    return await get_solidity_overview(db)


@router.get(
    "/solidity/scans-over-time",
    response_model=list[SolidityDailyScans],
    summary="Solidity scans per day",
)
async def solidity_scans_over_time(
    days: int = Query(default=30, ge=1, le=90),
    db=Depends(get_db),
):
    return await get_solidity_scans_over_time(db, days)
