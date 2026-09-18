import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from app.core.limiter import limiter
from app.dependencies import get_current_user
from app.models.chat import QueryRequest
from app.services import ai
from app.services.pdf import process_pdf_bytes
from app.services.retrieval import remove_document, store_document

router = APIRouter()

MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("/upload/")
@limiter.limit("5/minute")
async def upload_document(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDFs allowed.")

    file_bytes = await file.read()

    # Magic bytes check: real PDFs start with %PDF
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(400, "File does not appear to be a valid PDF.")
    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(413, "File too large. Maximum size is 20 MB.")

    try:
        # parsing is CPU-bound — keep it off the event loop
        chunks = await asyncio.get_running_loop().run_in_executor(None, process_pdf_bytes, file_bytes)
    except Exception as e:
        raise HTTPException(400, f"PDF read error: {str(e)}")

    count = await store_document(ai.client, current_user["_id"], file.filename, chunks)
    return {"message": "PDF processed and stored.", "chunks": count}


@router.post("/removefile/")
async def delete_document(current_user: dict = Depends(get_current_user)):
    await remove_document(current_user["_id"])
    return {"message": "Document deleted."}


@router.post("/query/")
@limiter.limit("30/minute")
async def ask_question(request: Request, query: QueryRequest, current_user: dict = Depends(get_current_user)):
    return await ai.query_doc(current_user, query.question)
