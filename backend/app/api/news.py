from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.news import CommitInfo


router = APIRouter(
    prefix="/api/news",
    tags=["news"],
)


@router.get(
    "/commits",
    response_model=list[CommitInfo],
    summary="Latest commits",
    description="Return latest commits from a local git repo",
)
async def list_commits(limit: int = 3, branch: str | None = None):
    branch_ref = branch or settings.github_branch
    repo = settings.github_repo
    url = f"https://api.github.com/repos/{repo}/commits"
    params = {"sha": branch_ref, "per_page": str(limit)}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {exc}")

    commits = []
    for item in response.json():
        sha = item.get("sha", "")
        message = item.get("commit", {}).get("message", "")
        date_str = item.get("commit", {}).get("author", {}).get("date", "")
        try:
            date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except ValueError:
            date = datetime.utcnow()
        commits.append(
            CommitInfo(
                sha=sha,
                short_sha=sha[:7],
                message=message,
                date=date,
            )
        )

    return commits
