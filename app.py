"""Minimal production-ready API and static SPA for the LEX hackathon MVP."""
from __future__ import annotations
import os
import hmac
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from engine import KnowledgeBase, LegalAssistant, model_config

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="LEX — Юридический ИИ-ассистент ПСБ", version="1.0.0")
kb = KnowledgeBase()
assistant = LegalAssistant(kb)
app.mount("/assets", StaticFiles(directory=ROOT / "static"), name="static")

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[Message] = Field(default_factory=list, max_length=20)

@app.get("/")
def index(): return FileResponse(ROOT / "static" / "index.html")

@app.get("/api/health")
def health():
    key, _, model = model_config()
    return {"ok": True, "api_configured": bool(key), "model": model,
            "access_protected": bool(os.getenv("DEMO_ACCESS_CODE")),
            "documents": len(kb.documents), "chunks": len(kb.chunks)}

@app.get("/api/documents")
def documents(q: str = "", category: str = ""):
    return {"items": kb.list_documents(q[:150], category[:80]), "total":len(kb.documents)}

@app.get("/api/documents/{document_id}")
def document(document_id: str):
    doc = kb.get_document(document_id)
    if not doc: raise HTTPException(404, detail="Документ не найден")
    return doc.public(include_text=True)

@app.get("/api/search")
def search(q: str):
    if not q.strip(): return {"items":[]}
    return {"items":[{k:v for k,v in c.items() if k != 'text'} | {"excerpt":c['text'][:650]} for c in kb.retrieve(q[:500], top_k=12)]}

@app.post("/api/chat")
def chat(req: ChatRequest, x_demo_access_code: str | None = Header(default=None)):
    # Public demos with a funded DeepSeek key should require an access code.
    expected = os.getenv("DEMO_ACCESS_CODE", "")
    if expected and not hmac.compare_digest(x_demo_access_code or "", expected):
        raise HTTPException(status_code=403, detail="Для доступа к демо нужен код команды")
    try:
        result = assistant.answer(req.question, [msg.model_dump() for msg in req.history])
    except RuntimeError as ex:
        # Clear, user-facing failure instead of false model output.
        raise HTTPException(status_code=503, detail=str(ex))
    return result
