from datetime import datetime

from pydantic import BaseModel


class CommitInfo(BaseModel):
    sha: str
    short_sha: str
    message: str
    date: datetime
