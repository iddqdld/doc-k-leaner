import uuid

from psycopg.types.json import Json

from app.schemas.filesupload import FileMetadata
from app.schemas.admin import AdminFileRecord
from app.schemas.stats import (
    AuditStats, DailyScans, DailySeverity, FileTypeCount, SourceCount,
    SolidityOverview, SolidityDailyScans, GlobalOverview,
)


async def insert_file_record(conn, metadata: FileMetadata, storage_path: str, owner_id: str | None = None) -> None:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO files (
                id, filename, content_type, size, source, original_url, storage_path, created_at, owner_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                metadata.file_id,
                metadata.filename,
                metadata.content_type,
                metadata.size,
                metadata.source,
                metadata.original_url,
                storage_path,
                metadata.uploaded_at,
                owner_id,
            ),
        )
    await conn.commit()


async def list_file_records(conn, limit: int = 50) -> list[AdminFileRecord]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT
                f.id,
                f.filename,
                f.content_type,
                f.size,
                f.source,
                f.original_url,
                f.storage_path,
                f.created_at,
                sr.status,
                sr.summary_json,
                sr.raw_output_path
            FROM files f
            LEFT JOIN LATERAL (
                SELECT status, summary_json, raw_output_path, created_at
                FROM scan_results
                WHERE file_id = f.id
                ORDER BY created_at DESC
                LIMIT 1
            ) sr ON true
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = await cur.fetchall()

    return [
        AdminFileRecord(
            id=str(row[0]),
            filename=row[1],
            content_type=row[2],
            size=row[3],
            source=row[4],
            original_url=row[5],
            storage_path=row[6],
            created_at=row[7],
            scan_status=row[8],
            scan_summary=row[9],
        )
        for row in rows
    ]


async def insert_scan_result(
    conn,
    file_id: str,
    scanner: str,
    status: str,
    summary: dict,
    raw_output_path: str,
    created_at,
) -> None:
    scan_id = str(uuid.uuid4())
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO scan_results (
                id, file_id, scanner, status, summary_json, raw_output_path, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                scan_id,
                file_id,
                scanner,
                status,
                Json(summary),
                raw_output_path,
                created_at,
            ),
        )
    await conn.commit()


async def get_audit_stats(conn) -> AuditStats:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM files) AS total_files,
                (SELECT COUNT(*) FROM scan_results) AS total_scans,
                COALESCE(SUM((summary_json->>'critical')::int), 0) AS critical,
                COALESCE(SUM((summary_json->>'high')::int), 0) AS high,
                COALESCE(SUM((summary_json->>'medium')::int), 0) AS medium,
                COALESCE(SUM((summary_json->>'low')::int), 0) AS low
            FROM scan_results
            """
        )
        row = await cur.fetchone()

    return AuditStats(
        total_files=row[0],
        total_scans=row[1],
        critical=row[2],
        high=row[3],
        medium=row[4],
        low=row[5],
    )


async def get_scans_over_time(conn, days: int = 30, offset: int = 0) -> list[DailyScans]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT d::date AS day, COALESCE(c.cnt, 0) AS count
            FROM generate_series(
                CURRENT_DATE - (%s + %s - 1) * INTERVAL '1 day',
                CURRENT_DATE - %s * INTERVAL '1 day',
                '1 day'
            ) AS d
            LEFT JOIN (
                SELECT created_at::date AS day, COUNT(*) AS cnt
                FROM scan_results
                WHERE created_at::date >= CURRENT_DATE - (%s + %s - 1) * INTERVAL '1 day'
                  AND created_at::date <= CURRENT_DATE - %s * INTERVAL '1 day'
                GROUP BY created_at::date
            ) c ON c.day = d::date
            ORDER BY day
            """,
            (offset, days, offset, offset, days, offset),
        )
        rows = await cur.fetchall()

    return [DailyScans(date=row[0].isoformat(), count=row[1]) for row in rows]


async def get_severity_over_time(conn, days: int = 30, offset: int = 0) -> list[DailySeverity]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT d::date AS day,
                   COALESCE(SUM((sr.summary_json->>'critical')::int), 0) AS critical,
                   COALESCE(SUM((sr.summary_json->>'high')::int), 0) AS high,
                   COALESCE(SUM((sr.summary_json->>'medium')::int), 0) AS medium,
                   COALESCE(SUM((sr.summary_json->>'low')::int), 0) AS low
            FROM generate_series(
                CURRENT_DATE - (%s + %s - 1) * INTERVAL '1 day',
                CURRENT_DATE - %s * INTERVAL '1 day',
                '1 day'
            ) AS d
            LEFT JOIN scan_results sr
                ON sr.created_at::date = d::date
                AND sr.created_at::date >= CURRENT_DATE - (%s + %s - 1) * INTERVAL '1 day'
                AND sr.created_at::date <= CURRENT_DATE - %s * INTERVAL '1 day'
            GROUP BY day
            ORDER BY day
            """,
            (offset, days, offset, offset, days, offset),
        )
        rows = await cur.fetchall()

    return [
        DailySeverity(
            date=row[0].isoformat(),
            critical=row[1],
            high=row[2],
            medium=row[3],
            low=row[4],
        )
        for row in rows
    ]


async def get_file_type_stats(conn) -> list[FileTypeCount]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT
                COALESCE(
                    NULLIF(LOWER(SUBSTRING(filename FROM '\.([^.]+)$')), ''),
                    'unknown'
                ) AS ext,
                COUNT(*) AS cnt
            FROM files
            GROUP BY ext
            ORDER BY cnt DESC
            LIMIT 10
            """
        )
        rows = await cur.fetchall()

    return [FileTypeCount(file_type=row[0], count=row[1]) for row in rows]


async def get_source_stats(conn) -> list[SourceCount]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT source, COUNT(*) AS cnt
            FROM files
            GROUP BY source
            ORDER BY cnt DESC
            """
        )
        rows = await cur.fetchall()

    return [SourceCount(source=row[0], count=row[1]) for row in rows]


async def get_solidity_overview(conn) -> SolidityOverview:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM solidity_contracts) AS total_contracts,
                (SELECT COUNT(*) FROM solidity_scans) AS total_scans,
                (SELECT COUNT(*) FROM solidity_scans WHERE status = 'complete') AS completed,
                (SELECT AVG(score) FROM solidity_scans WHERE status = 'complete' AND score IS NOT NULL),
                COALESCE(SUM((severity_counts->>'critical')::int), 0),
                COALESCE(SUM((severity_counts->>'high')::int), 0),
                COALESCE(SUM((severity_counts->>'medium')::int), 0),
                COALESCE(SUM((severity_counts->>'low')::int), 0),
                COALESCE(SUM((severity_counts->>'informational')::int), 0)
            FROM solidity_scans
            WHERE status = 'complete'
            """
        )
        row = await cur.fetchone()

    return SolidityOverview(
        total_contracts=row[0],
        total_scans=row[1],
        completed_scans=row[2],
        avg_score=round(row[3], 1) if row[3] is not None else None,
        critical=row[4],
        high=row[5],
        medium=row[6],
        low=row[7],
        informational=row[8],
    )


async def get_solidity_scans_over_time(conn, days: int = 30) -> list[SolidityDailyScans]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT d::date AS day, COALESCE(c.cnt, 0) AS count
            FROM generate_series(
                CURRENT_DATE - (%s - 1) * INTERVAL '1 day',
                CURRENT_DATE,
                '1 day'
            ) AS d
            LEFT JOIN (
                SELECT created_at::date AS day, COUNT(*) AS cnt
                FROM solidity_scans
                WHERE created_at >= CURRENT_DATE - (%s - 1) * INTERVAL '1 day'
                GROUP BY created_at::date
            ) c ON c.day = d::date
            ORDER BY day
            """,
            (days, days),
        )
        rows = await cur.fetchall()

    return [SolidityDailyScans(date=row[0].isoformat(), count=row[1]) for row in rows]


async def insert_sandbox_usage(conn, input_text: str, owner_id: str | None = None) -> None:
    line_count = input_text.count('\n') + (1 if input_text else 0)
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO sandbox_usage (id, input_length, line_count, created_at, owner_id)
            VALUES (%s, %s, %s, NOW(), %s)
            """,
            (str(uuid.uuid4()), len(input_text), line_count, owner_id),
        )
    await conn.commit()


async def get_global_overview(conn) -> GlobalOverview:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM files) +
                (SELECT COUNT(*) FROM solidity_contracts)
                AS total_files,
                COALESCE((SELECT SUM(size) FROM files), 0) +
                COALESCE((SELECT SUM(size) FROM solidity_contracts), 0)
                AS total_size,
                COALESCE((SELECT SUM(line_count) FROM sandbox_usage), 0)
                AS sandbox_lines
            """
        )
        row = await cur.fetchone()

    return GlobalOverview(
        total_files=row[0],
        total_size_bytes=row[1],
        sandbox_lines=row[2],
    )


async def get_admin_overview(conn) -> dict:
    async with conn.cursor() as cur:
        await cur.execute("SELECT COUNT(*) FROM users")
        total_users = (await cur.fetchone())[0]
        await cur.execute(
            "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
        )
        reg_7 = (await cur.fetchone())[0]
        await cur.execute(
            "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"
        )
        reg_30 = (await cur.fetchone())[0]
        await cur.execute(
            """
            SELECT COUNT(*)::float / NULLIF(COUNT(DISTINCT owner_id), 0)
            FROM (
                SELECT owner_id FROM files WHERE owner_id IS NOT NULL
                UNION ALL
                SELECT owner_id FROM solidity_contracts WHERE owner_id IS NOT NULL
            ) x
            """
        )
        row = await cur.fetchone()
        avg_scans = float(row[0] or 0) if row and row[0] is not None else 0.0
        await cur.execute(
            """
            SELECT COUNT(DISTINCT owner_id) FROM (
                SELECT owner_id FROM files WHERE owner_id IS NOT NULL
                UNION
                SELECT owner_id FROM solidity_contracts WHERE owner_id IS NOT NULL
            ) d
            """
        )
        users_with = (await cur.fetchone())[0] or 0
    return {
        "total_users": total_users,
        "registrations_last_7_days": reg_7,
        "registrations_last_30_days": reg_30,
        "avg_scans_per_user": round(avg_scans, 2),
        "users_with_owned_scans": users_with,
    }


async def list_users_for_admin(conn) -> list[dict]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT u.id, u.email, u.name, u.role, u.provider, u.created_at,
                COALESCE(f.cnt, 0) + COALESCE(s.cnt, 0) AS owned_items
            FROM users u
            LEFT JOIN (SELECT owner_id, COUNT(*) AS cnt FROM files WHERE owner_id IS NOT NULL GROUP BY owner_id) f
                ON f.owner_id = u.id
            LEFT JOIN (SELECT owner_id, COUNT(*) AS cnt FROM solidity_contracts WHERE owner_id IS NOT NULL GROUP BY owner_id) s
                ON s.owner_id = u.id
            ORDER BY u.created_at DESC
            """
        )
        rows = await cur.fetchall()
    return [
        {
            "id": str(r[0]),
            "email": r[1],
            "name": r[2],
            "role": r[3],
            "provider": r[4],
            "created_at": r[5].isoformat() if r[5] else "",
            "owned_items": int(r[6] or 0),
        }
        for r in rows
    ]


async def count_admins(conn) -> int:
    async with conn.cursor() as cur:
        await cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        return (await cur.fetchone())[0]


async def get_user_role(conn, user_id: str) -> str | None:
    async with conn.cursor() as cur:
        await cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        row = await cur.fetchone()
    return row[0] if row else None


async def delete_user_by_id(conn, user_id: str) -> bool:
    async with conn.cursor() as cur:
        await cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        deleted = cur.rowcount and cur.rowcount > 0
    await conn.commit()
    return bool(deleted)


async def get_user_scan_history(conn, user_id: str) -> list[dict]:
    """Return files + solidity contracts owned by a user, newest first."""
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT id, filename, size, 'trivy' AS scan_type, created_at
            FROM files WHERE owner_id = %s
            UNION ALL
            SELECT id, filename, size, 'solidity' AS scan_type, created_at
            FROM solidity_contracts WHERE owner_id = %s
            ORDER BY created_at DESC
            LIMIT 200
            """,
            (user_id, user_id),
        )
        rows = await cur.fetchall()
    return [
        {
            "id": str(r[0]),
            "filename": r[1],
            "size": r[2],
            "scan_type": r[3],
            "created_at": r[4].isoformat() if r[4] else "",
        }
        for r in rows
    ]


async def get_file_storage_path(conn, file_id: str) -> str | None:
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT storage_path FROM files WHERE id = %s",
            (file_id,),
        )
        row = await cur.fetchone()
    return row[0] if row else None


async def delete_file_record(conn, file_id: str) -> bool:
    """Delete a file record from Postgres (scan_results cascades via FK)."""
    async with conn.cursor() as cur:
        await cur.execute("DELETE FROM files WHERE id = %s", (file_id,))
        deleted = cur.rowcount and cur.rowcount > 0
    await conn.commit()
    return bool(deleted)
