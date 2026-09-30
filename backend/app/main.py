from contextlib import asynccontextmanager
from hashlib import sha256
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import distinct, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import get_session, initialize_tables
from .gemini import create_plan
from .models import GeminiPlanRecord, ProofReceipt
from .schemas import (
    HealthResponse,
    MetricsResponse,
    PlanRequest,
    ProofPlan,
    PublicReceiptCreate,
    ReceiptResponse,
)

settings = get_settings()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


@asynccontextmanager
async def lifespan(_: FastAPI):
    await initialize_tables()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["content-type"],
)


@app.get("/health", response_model=HealthResponse)
async def health(session: SessionDependency) -> HealthResponse:
    await session.execute(select(1))
    return HealthResponse(
        status="ok",
        database="ready",
        gemini="configured" if settings.gemini_api_key else "fallback",
    )


@app.get("/api/v1/metrics", response_model=MetricsResponse)
async def metrics(session: SessionDependency) -> MetricsResponse:
    total = await session.scalar(select(func.count(ProofReceipt.id))) or 0
    unique_workers = (
        await session.scalar(select(func.count(distinct(ProofReceipt.worker_contract_address))))
        or 0
    )
    rows = (
        await session.execute(
            select(ProofReceipt.signal_band, func.count(ProofReceipt.id)).group_by(
                ProofReceipt.signal_band
            )
        )
    ).all()
    counts = {band: count for band, count in rows}
    return MetricsResponse(
        total_proofs=total,
        unique_workers=unique_workers,
        steady=counts.get("steady", 0),
        stretched=counts.get("stretched", 0),
        urgent=counts.get("urgent", 0),
    )


@app.post("/api/v1/receipts", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    payload: PublicReceiptCreate,
    session: SessionDependency,
) -> ReceiptResponse:
    record = ProofReceipt(**payload.model_dump())
    session.add(record)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="Pulse transaction already registered"
        ) from error
    return ReceiptResponse(id=record.id)


@app.post("/api/v1/plans", response_model=ProofPlan)
async def compose_plan(
    payload: PlanRequest,
    session: SessionDependency,
) -> ProofPlan:
    plan = await create_plan(payload, settings)
    requirement_hash = sha256(payload.public_requirement.encode("utf-8")).hexdigest()
    session.add(
        GeminiPlanRecord(
            public_requirement_hash=requirement_hash,
            model=settings.gemini_model,
            source=plan.source,
            response_json=plan.model_dump(),
        )
    )
    await session.commit()
    return plan
