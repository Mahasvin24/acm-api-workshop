from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models import Registration

app = FastAPI(title="API Social", redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

apis = []


@app.get("/api/apis")
def list_apis():
    return {"apis": apis}


@app.post("/api/apis", status_code=201)
def register_api(api: Registration):
    apis.append(api)
    return api


app.mount("/", StaticFiles(directory=Path(__file__).parent / "public", html=True), name="website")
