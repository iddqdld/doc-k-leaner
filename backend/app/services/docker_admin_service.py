"""
Admin-only Docker stack inspection via Docker CLI (socket).
"""

from __future__ import annotations

import json
import re
import subprocess
from typing import Any

from app.core.config import settings
from app.services.scan_service import _resolve_docker_cli

_SERVICE_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$", re.I)
_MAX_TAIL = 2000
_DEFAULT_TAIL = 300
_TIMEOUT = 45


def _run(args: list[str], *, cwd: str | None = None) -> tuple[int, str, str]:
    docker = _resolve_docker_cli()
    if args[0] == "docker":
        args[0] = docker
    proc = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=_TIMEOUT,
        cwd=cwd or None,
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


def _parse_labels(labels_field: str) -> dict[str, str]:
    """Best-effort parse of docker ps Labels string (comma-separated k=v)."""
    out: dict[str, str] = {}
    if not labels_field or not isinstance(labels_field, str):
        return out
    for segment in labels_field.split(","):
        segment = segment.strip()
        if "=" in segment:
            k, _, v = segment.partition("=")
            k, v = k.strip(), v.strip()
            if k:
                out[k] = v
    return out


def _container_row(obj: dict[str, Any]) -> dict[str, Any]:
    labels_raw = obj.get("Labels") or ""
    if isinstance(labels_raw, dict):
        labels = {str(k): str(v) for k, v in labels_raw.items()}
    else:
        labels = _parse_labels(str(labels_raw))
    service = labels.get("com.docker.compose.service") or ""
    name = (obj.get("Names") or "").strip()
    if not name and obj.get("ID"):
        name = (obj.get("ID") or "")[:12]
    if not service:
        service = name.split("/")[-1] if "/" in name else name
    cid = (obj.get("ID") or "")[:12]
    return {
        "service": service or "unknown",
        "name": name or cid,
        "container_id": cid,
        "state": (obj.get("State") or "").strip(),
        "status": (obj.get("Status") or "").strip(),
        "image": (obj.get("Image") or "").strip(),
    }


def list_stack_containers() -> tuple[list[dict[str, Any]], str | None]:
    """
    Return container rows for the configured Compose project, or all if project is '*'.
    """
    project = (settings.docker_compose_project or "").strip()
    docker = _resolve_docker_cli()
    cmd = [docker, "ps", "-a", "--format", "{{json .}}"]
    hint: str | None = None

    if project and project != "*":
        cmd.extend(["--filter", f"label=com.docker.compose.project={project}"])

    code, out, err = _run(cmd)
    if code != 0:
        return [], (err or out or "docker ps failed").strip() or "docker ps failed"

    rows: list[dict[str, Any]] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        rows.append(_container_row(obj))

    if project and project != "*" and not rows:
        hint = (
            f"No containers with label com.docker.compose.project={project!r}. "
            "Set DOCKCLEANER_DOCKER_COMPOSE_PROJECT to your compose project name, or '*' to list all."
        )

    return rows, hint


def fetch_container_logs(service: str, tail: int = _DEFAULT_TAIL) -> tuple[str | None, str | None]:
    """Stream recent logs for a compose service name."""
    if not _SERVICE_RE.match(service or ""):
        return None, "Invalid service name"
    tail = max(1, min(int(tail), _MAX_TAIL))
    project = (settings.docker_compose_project or "").strip()
    docker = _resolve_docker_cli()
    cmd = [docker, "ps", "-aq", "--filter", f"label=com.docker.compose.service={service}"]
    if project and project != "*":
        cmd.extend(["--filter", f"label=com.docker.compose.project={project}"])

    code, out, err = _run(cmd)
    if code != 0:
        return None, (err or "docker ps failed").strip()

    ids = [x.strip() for x in out.splitlines() if x.strip()]
    if not ids:
        cmd2 = [docker, "ps", "-aq", "--filter", f"name={service}"]
        if project and project != "*":
            cmd2.extend(["--filter", f"label=com.docker.compose.project={project}"])
        code2, out2, _ = _run(cmd2)
        if code2 == 0:
            ids = [x.strip() for x in out2.splitlines() if x.strip()]

    if not ids:
        return None, f"No container found for service {service!r}"

    running_cmd = [
        docker, "ps", "-q",
        "--filter", f"label=com.docker.compose.service={service}",
    ]
    if project and project != "*":
        running_cmd.extend(["--filter", f"label=com.docker.compose.project={project}"])
    code_r, out_r, _ = _run(running_cmd)
    target = (out_r.strip().splitlines()[-1] if code_r == 0 and out_r.strip() else None) or ids[-1]
    code3, log_out, log_err = _run(
        [docker, "logs", "--tail", str(tail), "--timestamps", target]
    )
    if code3 != 0:
        return None, (log_err or log_out or "docker logs failed").strip()

    return log_out, None
