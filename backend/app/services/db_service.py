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
            SELECT id, filename, content_type, size, source, original_url, storage_path, created_at
            FROM files
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
        )
        for row in rows
    ]
