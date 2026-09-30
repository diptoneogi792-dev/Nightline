"""Create public Nightline metadata tables."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260928_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "proof_receipts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("network", sa.String(16), nullable=False),
        sa.Column("worker_contract_address", sa.String(128), nullable=False),
        sa.Column("deployment_tx_hash", sa.String(128), nullable=False),
        sa.Column("pulse_tx_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("signal_band", sa.String(16), nullable=False),
        sa.Column("disclosure_scope", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_receipts_network", "proof_receipts", ["network"])
    op.create_index("ix_receipts_worker", "proof_receipts", ["worker_contract_address"])
    op.create_index("ix_receipts_pulse_tx", "proof_receipts", ["pulse_tx_hash"], unique=True)
    op.create_index("ix_receipts_band", "proof_receipts", ["signal_band"])

    op.create_table(
        "gemini_plan_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("public_requirement_hash", sa.String(64), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("source", sa.String(24), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_plan_requirement_hash", "gemini_plan_records", ["public_requirement_hash"])

    op.create_table(
        "public_authorities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("policy_url", sa.Text(), nullable=False),
        sa.Column("active_network", sa.String(16), nullable=False, server_default="preview"),
    )


def downgrade() -> None:
    op.drop_table("public_authorities")
    op.drop_index("ix_plan_requirement_hash", table_name="gemini_plan_records")
    op.drop_table("gemini_plan_records")
    op.drop_index("ix_receipts_band", table_name="proof_receipts")
    op.drop_index("ix_receipts_pulse_tx", table_name="proof_receipts")
    op.drop_index("ix_receipts_worker", table_name="proof_receipts")
    op.drop_index("ix_receipts_network", table_name="proof_receipts")
    op.drop_table("proof_receipts")
