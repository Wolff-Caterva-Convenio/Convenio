from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers.auth import router as auth_router
from app.routers.venues_router import router as venues_router
from app.routers.availability_router import router as availability_router
from app.routers.bookings_router import router as bookings_router
from app.routers.payments_router import router as payments_router
from app.routers.messaging_router import router as messaging_router
from app.routers.reviews_router import router as reviews_router
from app.routers.disputes_router import router as disputes_router


def create_app() -> FastAPI:
    app = FastAPI(title="Convenio API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):3000$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    uploads_dir = Path("uploads")
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

    app.include_router(auth_router)
    app.include_router(bookings_router)
    app.include_router(venues_router)
    app.include_router(availability_router)
    app.include_router(payments_router)
    app.include_router(messaging_router)
    app.include_router(reviews_router)
    app.include_router(disputes_router)

    @app.get("/health")
    def health():
        return {"ok": True}

    return app


app = create_app()