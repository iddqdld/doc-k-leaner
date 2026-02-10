from fastapi import APIRouter, Depends

from app.db.postgres import get_db
from app.schemas.stats import AuditStats
from app.services.db_service import get_audit_stats


router = APIRouter(
    prefix="/api/stats",
    tags=["stats"],
)


@router.get(
    "/overview",
    response_model=AuditStats,
    summary="Audit stats overview",
    description="Return aggregate scan statistics from Postgres",
)
async def stats_overview(db=Depends(get_db)):
    return await get_audit_stats(db)
