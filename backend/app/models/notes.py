import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class Notebook(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Note(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    notebook_id: str
    title: str
    content: str
    is_favorite: bool = False
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CreateNotebookRequest(BaseModel):
    name: str

class UpdateNotebookRequest(BaseModel):
    name: str

class CreateNoteRequest(BaseModel):
    title: str
    content: str

class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    notebook_id: Optional[str] = None
    is_favorite: Optional[bool] = None

class ReorderNotesRequest(BaseModel):
    notes: list[dict] # List of {"id": str, "order": int}
