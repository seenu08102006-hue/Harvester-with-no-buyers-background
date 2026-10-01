"""
HarvestLink AI — FastAPI Application Entry Point
"""
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine, Base, init_db
from app.routes import farmers, buyers, vehicles, ai, dashboard, auth, rides
from app.routes import transport
from app.routes.transport import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="HarvestFlow.ai",
    description="AI-powered coordination platform for agricultural supply chains",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Authentication ──
app.include_router(auth.router, prefix="/api", tags=["Authentication"])

# ── Legacy routes (kept for backward compatibility) ──
app.include_router(farmers.router, prefix="/api", tags=["Farmers & Harvests"])
app.include_router(buyers.router, prefix="/api", tags=["Buyers & Orders"])
app.include_router(vehicles.router, prefix="/api", tags=["Vehicles"])
app.include_router(rides.router, prefix="/api", tags=["Rides"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Coordination"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])

# ── New extended routes ──
app.include_router(transport.router, prefix="/api", tags=["Transport Agent & Real-time"])

@app.websocket("/ws")
async def root_ws(websocket: WebSocket, role: str = "all"):
    await websocket_endpoint(websocket, role)

# --- HACKATHON LIVE DEMO ENDPOINTS ---
live_links = []
from pydantic import BaseModel
class DemoLink(BaseModel):
    farmer: str
    farmerLoc: str
    transporter: str
    buyer: str
    buyerLoc: str
    volume: float
    quality: str
    status: str
    date: str

@app.post("/api/links", tags=["Demo"])
async def create_link(link: DemoLink):
    new_link = link.dict()
    new_link["id"] = len(live_links) + 1
    live_links.insert(0, new_link)
    return new_link

@app.get("/api/links", tags=["Demo"])
async def get_links():
    return live_links
# -----------------------------------

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

# --- SERVE UNIFIED FRONTEND SPA ---
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

@app.get("/", tags=["Health"])
async def root():
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {
        "name": "HarvestLink AI",
        "tagline": "Turning scattered harvests into coordinated deliveries.",
        "status": "running",
        "version": "2.0.0",
    }

if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path == "openapi.json" or full_path.startswith("ws"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")
