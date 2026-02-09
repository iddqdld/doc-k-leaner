import uuid

from psycopg.types.json import Json

from app.schemas.filesupload import FileMetadata
from app.schemas.admin import AdminFileRecord


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
