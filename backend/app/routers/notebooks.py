from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from app.dependencies import get_current_user
from app.db.client import get_collection
from app.models.notes import (
    CreateNotebookRequest, UpdateNotebookRequest, CreateNoteRequest, UpdateNoteRequest, ReorderNotesRequest
)
from pymongo import UpdateOne

router = APIRouter()

# --- Notebooks ---

@router.get("/notebooks")
async def get_notebooks(current_user: dict = Depends(get_current_user)):
    return current_user.get("notebooks", [])

@router.post("/notebooks")
async def create_notebook(request: CreateNotebookRequest, current_user: dict = Depends(get_current_user)):
    new_notebook = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "created_at": datetime.now(timezone.utc)
    }
    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"notebooks": new_notebook}}
    )
    return new_notebook

@router.put("/notebooks/{notebook_id}")
async def update_notebook(notebook_id: str, request: UpdateNotebookRequest, current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    result = await users.update_one(
        {"_id": current_user["_id"], "notebooks.id": notebook_id},
        {"$set": {"notebooks.$.name": request.name}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return {"message": "Notebook updated successfully"}

@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: str, current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    result = await users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"notebooks": {"id": notebook_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Cascade delete notes
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"notes": {"notebook_id": notebook_id}}}
    )
    return {"message": "Notebook deleted successfully"}

# --- Notes ---

@router.get("/notebooks/{notebook_id}/notes")
async def get_notes(notebook_id: str, current_user: dict = Depends(get_current_user)):
    all_notes = current_user.get("notes", [])
    filtered_notes = [n for n in all_notes if n.get("notebook_id") == notebook_id]
    return sorted(filtered_notes, key=lambda x: x.get("order", 0))

@router.post("/notebooks/{notebook_id}/notes")
async def create_note(notebook_id: str, request: CreateNoteRequest, current_user: dict = Depends(get_current_user)):
    notebooks = current_user.get("notebooks", [])
    if not any(nb["id"] == notebook_id for nb in notebooks):
        raise HTTPException(status_code=404, detail="Notebook not found")

    all_notes = current_user.get("notes", [])
    current_notebook_notes = [n for n in all_notes if n.get("notebook_id") == notebook_id]
    max_order = max([n.get("order", 0) for n in current_notebook_notes], default=-1)

    new_note = {
        "id": str(uuid.uuid4()),
        "notebook_id": notebook_id,
        "title": request.title,
        "content": request.content,
        "is_favorite": False,
        "order": max_order + 1,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"notes": new_note}}
    )
    return new_note

@router.put("/notebooks/{notebook_id}/reorder")
async def reorder_notes(notebook_id: str, request: ReorderNotesRequest, current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    
    operations = []
    for item in request.notes:
        operations.append(
            UpdateOne(
                {"_id": current_user["_id"], "notes.id": item["id"]},
                {"$set": {"notes.$.order": item["order"]}}
            )
        )
    
    if operations:
        await users.bulk_write(operations)
        
    return {"message": "Notes reordered successfully"}

@router.get("/notes")
async def get_all_notes(current_user: dict = Depends(get_current_user)):
    """Every note across notebooks, most recently edited first (used for search and favourites)."""
    notes = current_user.get("notes", [])
    return sorted(notes, key=lambda n: n.get("updated_at") or n.get("created_at") or "", reverse=True)

@router.get("/notes/{note_id}")
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    notes = current_user.get("notes", [])
    note = next((n for n in notes if n["id"] == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.put("/notes/{note_id}")
async def update_note(note_id: str, request: UpdateNoteRequest, current_user: dict = Depends(get_current_user)):
    update_fields = {"notes.$.updated_at": datetime.now(timezone.utc)}
    
    if request.title is not None:
        update_fields["notes.$.title"] = request.title
    if request.content is not None:
        update_fields["notes.$.content"] = request.content
    if request.notebook_id is not None:
        update_fields["notes.$.notebook_id"] = request.notebook_id
    if request.is_favorite is not None:
        update_fields["notes.$.is_favorite"] = request.is_favorite

    users = get_collection("users")
    result = await users.update_one(
        {"_id": current_user["_id"], "notes.id": note_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note updated successfully"}

@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    result = await users.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"notes": {"id": note_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}
