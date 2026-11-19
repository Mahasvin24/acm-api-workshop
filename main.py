import hashlib
import hmac
import math
import re
import secrets
import sqlite3
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from models import PublicRegistration, Registration, RegistrationCreated, RegistrationUpdate

HERE = Path(__file__).resolve().parent
PUBLIC_FIELDS = "id, name, creator, description, ip, port, created_at"


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_app(database=HERE / "data" / "registry.sqlite", rate_limit=60):
    lock = threading.RLock()

    @asynccontextmanager
    async def lifespan(app):
        if str(database) != ":memory:":
            Path(database).parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(str(database), check_same_thread=False)
        db.row_factory = sqlite3.Row
        db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS apis (
                id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                creator TEXT NOT NULL, description TEXT NOT NULL,
                ip TEXT NOT NULL, port INTEGER NOT NULL, token_hash TEXT NOT NULL,
                created_at TEXT NOT NULL, UNIQUE(ip, port)
            );
        """)
        app.state.db = db
        try:
            yield
        finally:
            db.close()

    app = FastAPI(title="API Social", lifespan=lifespan, docs_url=None, redoc_url=None)
    requests = {}
    window_ends = time.monotonic() + 60

    @app.middleware("http")
    async def request_rules(request: Request, call_next):
        nonlocal window_ends
        if request.method == "OPTIONS":
            return Response(status_code=204)
        is_api = request.url.path == "/api" or request.url.path.startswith("/api/")
        response = None
        if is_api and request.method not in ("GET", "HEAD"):
            # Cache the body so FastAPI can read it after this middleware.
            length = request.headers.get("content-length", "")
            if (length.isdigit() and int(length) > 8192) or len(await request.body()) > 8192:
                response = JSONResponse({"error": "Keep your JSON under 8 KB."}, status_code=413)
            else:
                if time.monotonic() >= window_ends:
                    requests.clear()
                    window_ends = time.monotonic() + 60
                client = request.client.host if request.client else "unknown"
                requests[client] = requests.get(client, 0) + 1
                if requests[client] > rate_limit:
                    response = JSONResponse(
                        {"error": "Too many changes. Try again in one minute."}, status_code=429,
                        headers={"Retry-After": str(max(1, math.ceil(window_ends - time.monotonic())))},
                    )
                elif request.method != "DELETE" and request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
                    response = JSONResponse(
                        {"error": "Set Content-Type to application/json and choose raw JSON in Postman."},
                        status_code=415,
                    )
        if response is None:
            response = await call_next(request)
        response.headers.update({
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'self'; img-src 'self' https://www.ucsbacm.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        })
        if is_api:
            response.headers["Cache-Control"] = "no-store"
        return response

    # Added last so CORS also wraps validation and middleware error responses.
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"],
        allow_methods=["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Location", "Retry-After"], max_age=600,
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        errors = error.errors()
        if any(e["type"] == "json_invalid" for e in errors):
            return JSONResponse({"error": "Invalid JSON. Check commas, quotes, and trailing commas."}, status_code=400)
        fields = {str(e["loc"][-1]) if len(e["loc"]) > 1 else "body": e["msg"] for e in errors}
        message = "Check your update." if request.method == "PATCH" else "Check your registration."
        return JSONResponse({"error": message, "fields": fields}, status_code=400)

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse({"error": error.detail}, status_code=error.status_code)

    @app.exception_handler(sqlite3.IntegrityError)
    async def duplicate_error(request, error):
        return JSONResponse({"error": "That API name or IP + port is already registered. PATCH your entry or choose a different one."}, status_code=409)

    def get_entry(db, entry_id):
        row = db.execute(f"SELECT {PUBLIC_FIELDS} FROM apis WHERE id = ?", (entry_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "API not found.")
        return dict(row)

    def check_owner(db, entry_id, request):
        row = db.execute("SELECT token_hash FROM apis WHERE id = ?", (entry_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "API not found.")
        match = re.fullmatch(r"Bearer ([a-f0-9]{48})", request.headers.get("authorization", ""))
        if not match or not hmac.compare_digest(token_hash(match[1]), row["token_hash"]):
            raise HTTPException(401, "Use Authorization: Bearer YOUR_EDIT_TOKEN from your registration response.")

    @app.api_route("/api/health", methods=["GET", "HEAD"])
    def health():
        return {"status": "ok"}

    @app.api_route("/api/apis", methods=["GET", "HEAD"], response_model=dict[str, list[PublicRegistration]])
    def list_entries(request: Request):
        with lock:
            rows = request.app.state.db.execute(f"SELECT {PUBLIC_FIELDS} FROM apis ORDER BY created_at DESC, rowid DESC").fetchall()
            return {"apis": [dict(row) for row in rows]}

    @app.api_route("/api/apis/{entry_id}", methods=["GET", "HEAD"], response_model=PublicRegistration)
    def read_entry(entry_id: str, request: Request):
        with lock:
            return get_entry(request.app.state.db, entry_id)

    @app.post("/api/apis", response_model=RegistrationCreated, status_code=201)
    def register(api: Registration, request: Request, response: Response):
        db = request.app.state.db
        with lock, db:
            if db.execute("SELECT COUNT(*) FROM apis").fetchone()[0] >= 500:
                raise HTTPException(503, "The workshop directory is full. Ask your host.")
            entry_id, edit_token = secrets.token_hex(8), secrets.token_hex(24)
            db.execute("INSERT INTO apis VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (
                entry_id, api.name, api.creator, api.description, api.ip, api.port,
                token_hash(edit_token), datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            ))
            response.headers["Location"] = f"/api/apis/{entry_id}"
            return {**get_entry(db, entry_id), "edit_token": edit_token,
                    "message": "You are on the board! Save your edit_token; it is only shown once."}

    @app.patch("/api/apis/{entry_id}", response_model=PublicRegistration)
    def update_entry(entry_id: str, update: RegistrationUpdate, request: Request):
        db = request.app.state.db
        with lock, db:
            check_owner(db, entry_id, request)
            fields = update.model_dump(exclude_unset=True)
            # Field names come only from the validated Pydantic model.
            assignments = ", ".join(f"{key} = ?" for key in fields)
            db.execute(f"UPDATE apis SET {assignments} WHERE id = ?", (*fields.values(), entry_id))
            return get_entry(db, entry_id)

    @app.delete("/api/apis/{entry_id}", status_code=204)
    def delete_entry(entry_id: str, request: Request):
        db = request.app.state.db
        with lock, db:
            check_owner(db, entry_id, request)
            db.execute("DELETE FROM apis WHERE id = ?", (entry_id,))
        return Response(status_code=204)

    @app.api_route("/api/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])
    def unknown_route(path: str):
        raise HTTPException(404, "Route not found. Try GET /api/apis or POST /api/apis.")

    app.mount("/", StaticFiles(directory=HERE / "public", html=True), name="website")
    return app


app = create_app()
