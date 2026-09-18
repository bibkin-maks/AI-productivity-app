from pydantic import BaseModel


class QueryRequest(BaseModel):
    question: str

class SpeakRequest(BaseModel):
    text: str
    voice: str | None = None
