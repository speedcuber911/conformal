"""FastAPI entrypoint.

Two routes for asking questions:

- `POST /query` — synchronous; returns the full workflow state once the
  pipeline has run end-to-end. Used by tests and the CLI.
- `POST /query/stream` — Server-Sent Events; emits a sequence of typed events
  (`interpretation`, `plan`, `analysis_started`, `analysis_complete`,
  `narrative_chunk`, `presentation`, `done`) so the frontend can paint
  progressively. Drives the production demo UI.
"""
from __future__ import annotations

import asyncio
import json
import threading
from contextlib import asynccontextmanager
from queue import Queue

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend.contracts import ChartSpec, Message, WorkflowState
from backend.duckdb_loader import open_database
from backend.pipeline import run_pipeline

load_dotenv()


class QueryRequest(BaseModel):
    question: str
    history: list[Message] = []


class QueryResponse(BaseModel):
    state: WorkflowState
    chart_specs: list[ChartSpec]


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = open_database()
    app.state.duckdb = conn
    app.state.table_row_counts = {
        row[0]: conn.execute(f'SELECT COUNT(*) FROM "{row[0]}"').fetchone()[0]
        for row in conn.execute("SHOW TABLES").fetchall()
    }
    try:
        yield
    finally:
        conn.close()


app = FastAPI(title="SFS Enterprise Chatbot — Phase 3", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "tables_loaded": len(app.state.table_row_counts),
        "total_rows": sum(app.state.table_row_counts.values()),
    }


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest) -> QueryResponse:
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    state, specs = run_pipeline(
        req.question,
        conn=app.state.duckdb,
        history=req.history,
    )
    return QueryResponse(state=state, chart_specs=specs)


@app.post("/query/stream")
async def query_stream(req: QueryRequest):
    """Run the pipeline on a worker thread; forward each event as SSE.

    The pipeline itself is synchronous (blocking LLM/DuckDB calls), so we run
    it in a thread and shuttle events through a thread-safe queue. The async
    generator drains the queue and yields SSE frames.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    queue: Queue = Queue()
    SENTINEL = object()

    def on_event(name: str, data: dict) -> None:
        queue.put((name, data))

    def runner() -> None:
        try:
            run_pipeline(
                req.question,
                conn=app.state.duckdb,
                history=req.history,
                on_event=on_event,
                stream_narrative=True,
            )
        except Exception as exc:  # noqa: BLE001 — surface to client
            queue.put(("error", {"stage": "pipeline", "message": str(exc)}))
        finally:
            queue.put(SENTINEL)

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()

    async def event_source():
        loop = asyncio.get_running_loop()
        while True:
            item = await loop.run_in_executor(None, queue.get)
            if item is SENTINEL:
                break
            name, data = item
            yield {"event": name, "data": json.dumps(data, default=str)}

    return EventSourceResponse(event_source())
