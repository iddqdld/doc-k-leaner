import asyncio
import json
import os
import subprocess
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


def build_scan_output_path(file_id: str) -> str:
    return os.path.join(settings.scan_dir, f"{file_id}.json")


def _map_storage_path_for_trivy(storage_path: str) -> str:
    if storage_path.startswith(settings.storage_dir):
        relative = storage_path[len(settings.storage_dir) :].lstrip(os.sep)
        return os.path.join("/data/storage", relative)
    return storage_path


def _extract_original_filename(storage_path: str) -> str:
    basename = os.path.basename(storage_path)
    if "__" in basename:
        return basename.split("__", 1)[1]
    return basename


def _detect_trivy_mode(filename: str) -> str:
    lower = filename.lower()
    if lower == "dockerfile" or lower.startswith("dockerfile."):
        return "config"
    ext = os.path.splitext(lower)[1]
    if ext in {".yaml", ".yml", ".json", ".toml", ".tf", ".tfvars", ".hcl", ".env", ".properties", ".conf", ".cfg"}:
        return "config"
    return "config"


def _build_file_patterns(filename: str, storage_path: str) -> list[str]:
    lower = filename.lower()
    basename = os.path.basename(storage_path)
    patterns: list[str] = []
    if lower == "dockerfile" or lower.startswith("dockerfile."):
        patterns.append(f"dockerfile:{basename}")
    return patterns


def _resolve_docker_cli() -> str:
    candidates = [settings.docker_cli_path, "/usr/bin/docker", "/usr/local/bin/docker", "docker"]
    for candidate in candidates:
        if candidate == "docker":
            return candidate
        if os.path.exists(candidate):
            return candidate
    return "docker"


def _empty_summary(status: str, error: str | None = None) -> dict[str, Any]:
    summary = {
        "status": status,
        "total": 0,
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "unknown": 0,
    }
    if error:
        summary["error"] = error
    return summary


def _parse_trivy_summary(payload: dict[str, Any]) -> dict[str, Any]:
    counts = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "unknown": 0,
    }

    for result in payload.get("Results", []) or []:
        for item in result.get("Vulnerabilities", []) or []:
            severity = str(item.get("Severity", "UNKNOWN")).upper()
            key = severity.lower() if severity.lower() in counts else "unknown"
            counts[key] += 1
        for item in result.get("Misconfigurations", []) or []:
            severity = str(item.get("Severity", "UNKNOWN")).upper()
            key = severity.lower() if severity.lower() in counts else "unknown"
            counts[key] += 1

    total = sum(counts.values())
    return {
        "status": "completed",
        "total": total,
        **counts,
    }


async def run_trivy_scan(file_id: str, storage_path: str) -> tuple[dict[str, Any], str, str, datetime]:
    os.makedirs(settings.scan_dir, exist_ok=True)
    output_path = build_scan_output_path(file_id)
    created_at = datetime.now(timezone.utc)

    trivy_path = _map_storage_path_for_trivy(storage_path)
    filename = _extract_original_filename(storage_path)
    mode = _detect_trivy_mode(filename)
    docker_cli = _resolve_docker_cli()
    trivy_target = os.path.dirname(trivy_path) or trivy_path
    file_patterns = _build_file_patterns(filename, storage_path)
    cmd = [
        docker_cli,
        "exec",
        "trivy",
        "trivy",
        mode,
        "--format",
        "json",
        "--quiet",
        *[item for pattern in file_patterns for item in ["--file-patterns", pattern]],
        trivy_target,
    ]

    def _run():
        return subprocess.run(cmd, capture_output=True, text=True)

    try:
        result = await asyncio.to_thread(_run)
    except FileNotFoundError:
        summary = _empty_summary("failed", "Docker CLI not found in backend container")
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump({"error": summary.get("error")}, handle)
        return summary, output_path, "failed", created_at
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()

    if result.returncode != 0:
        summary = _empty_summary("failed", stderr or "Trivy scan failed")
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump({"error": summary.get("error")}, handle)
        return summary, output_path, "failed", created_at

    try:
        payload = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        summary = _empty_summary("failed", "Trivy output is not valid JSON")
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump({"error": summary.get("error")}, handle)
        return summary, output_path, "failed", created_at

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)

    summary = _parse_trivy_summary(payload)
    return summary, output_path, "completed", created_at
