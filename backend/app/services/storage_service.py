import os
from typing import Optional

from app.core.config import settings


def build_storage_path(file_id: str, filename: str) -> str:
    safe_name = os.path.basename(filename) or "file"
    return os.path.join(settings.storage_dir, f"{file_id}__{safe_name}")


def save_file_to_disk(file_id: str, filename: str, content: bytes) -> str:
    os.makedirs(settings.storage_dir, exist_ok=True)
    path = build_storage_path(file_id, filename)
    with open(path, "wb") as handle:
        handle.write(content)
    return path


def delete_file_from_disk(path: Optional[str]) -> None:
    if not path:
        return
    try:
        os.remove(path)
    except FileNotFoundError:
        return
