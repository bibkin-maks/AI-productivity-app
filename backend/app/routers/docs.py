from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Request
from app.dependencies import get_current_user
from app.services.pdf import process_pdf_bytes
from app.db.client import get_collection
from app.models.chat import QueryRequest
from app.services.ai import query_doc
from app.core.limiter import limiter

router = APIRouter()

@router.post("/upload/")
@limiter.limit("5/minute")
async def upload_document(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDFs allowed.")

    file_bytes = await file.read()

    # Magic bytes check: real PDFs start with %PDF (0x25504446)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(400, "File does not appear to be a valid PDF.")

    MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 MB
    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(413, "File too large. Maximum size is 20 MB.")

    try:
        chunks = process_pdf_bytes(file_bytes)
    except Exception as e:
        raise HTTPException(400, f"PDF read error: {str(e)}")

    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"document": {"name": file.filename, "chunks": chunks}}}
    )
    return {"message": "PDF processed and stored."}

@router.post("/removefile/")
async def delete_document(current_user: dict = Depends(get_current_user)):
    users = get_collection("users")
    await users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"document": {"name": "", "chunks": []}}}
    )
    return {"message": "Document deleted."}

@router.post("/query/")
@limiter.limit("30/minute")
async def ask_question(request: Request, query: QueryRequest, current_user: dict = Depends(get_current_user)):
    return await query_doc(current_user, query.question)
