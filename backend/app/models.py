from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class ProofReceipt(Base):
    __tablename__ = "proof_receipts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    network: Mapped[str] = mapped_column(String(16), index=True)
    worker_contract_address: Mapped[str] = mapped_column(String(128), index=True)
    deployment_tx_hash: Mapped[str] = mapped_column(String(128))
    pulse_tx_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    signal_band: Mapped[str] = mapped_column(String(16), index=True)
    disclosure_scope: Mapped[list[str]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class GeminiPlanRecord(Base):
    __tablename__ = "gemini_plan_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    public_requirement_hash: Mapped[str] = mapped_column(String(64), index=True)
    model: Mapped[str] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(24))
    response_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class PublicAuthority(Base):
    __tablename__ = "public_authorities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    display_name: Mapped[str] = mapped_column(String(160))
    policy_url: Mapped[str] = mapped_column(Text)
    active_network: Mapped[str] = mapped_column(String(16), default="preview")
