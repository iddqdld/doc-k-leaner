import uuid

from psycopg.types.json import Json

from app.schemas.filesupload import FileMetadata
from app.schemas.admin import AdminFileRecord
from app.schemas.stats import AuditStats, DailyScans, DailySeverity, FileTypeCount, SourceCount


async def insert_file_record(conn, metadata: FileMetadata, storage_path: str) -> None:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO files (
                id, filename, content_type, size, source, original_url, storage_path, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
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


async def get_scans_over_time(conn, days: int = 30) -> list[DailyScans]:
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
                FROM scan_results
                WHERE created_at >= CURRENT_DATE - (%s - 1) * INTERVAL '1 day'
                GROUP BY created_at::date
            ) c ON c.day = d::date
            ORDER BY day
            """,
            (days, days),
        )
        rows = await cur.fetchall()

    return [DailyScans(date=row[0].isoformat(), count=row[1]) for row in rows]


async def get_severity_over_time(conn, days: int = 30) -> list[DailySeverity]:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT d::date AS day,
                   COALESCE(SUM((sr.summary_json->>'critical')::int), 0) AS critical,
                   COALESCE(SUM((sr.summary_json->>'high')::int), 0) AS high,
                   COALESCE(SUM((sr.summary_json->>'medium')::int), 0) AS medium,
                   COALESCE(SUM((sr.summary_json->>'low')::int), 0) AS low
            FROM generate_series(
                CURRENT_DATE - (%s - 1) * INTERVAL '1 day',
                CURRENT_DATE,
                '1 day'
            ) AS d
            LEFT JOIN scan_results sr
                ON sr.created_at::date = d::date
                AND sr.created_at >= CURRENT_DATE - (%s - 1) * INTERVAL '1 day'
            GROUP BY day
            ORDER BY day
            """,
            (days, days),
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
