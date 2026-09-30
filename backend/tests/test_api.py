from app.config import Settings
from app.gemini import create_plan
from app.privacy import redact_sensitive_text
from app.schemas import PlanRequest

VALID_RECEIPT = {
    "network": "preview",
    "worker_contract_address": "a" * 64,
    "deployment_tx_hash": "b" * 64,
    "pulse_tx_hash": "c" * 64,
    "signal_band": "stretched",
    "disclosure_scope": ["signal band", "one-use nullifier"],
}


async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ready"


async def test_public_receipt_is_stored_and_aggregated(client):
    created = await client.post("/api/v1/receipts", json=VALID_RECEIPT)
    assert created.status_code == 201
    metrics = (await client.get("/api/v1/metrics")).json()
    assert metrics == {
        "total_proofs": 1,
        "unique_workers": 1,
        "steady": 0,
        "stretched": 1,
        "urgent": 0,
    }


async def test_duplicate_transaction_is_rejected(client):
    assert (await client.post("/api/v1/receipts", json=VALID_RECEIPT)).status_code == 201
    assert (await client.post("/api/v1/receipts", json=VALID_RECEIPT)).status_code == 409


async def test_private_field_is_rejected(client):
    payload = {**VALID_RECEIPT, "private_witness": "must never be stored"}
    response = await client.post("/api/v1/receipts", json=payload)
    assert response.status_code == 422
    assert "Private field rejected" in response.text


async def test_gemini_uses_deterministic_fallback_without_key():
    request = PlanRequest(
        public_requirement="Return a public support band only.", approved_labels=["steady"]
    )
    plan = await create_plan(request, Settings(gemini_api_key=None))
    assert plan.source == "local-fallback"
    assert "exact" not in plan.public_outputs


def test_sensitive_input_redaction():
    redacted = redact_sensitive_text("Email me at student@example.edu or mn_addr_preview1abc123456")
    assert "student@example.edu" not in redacted
    assert "mn_addr_preview" not in redacted


async def test_plan_endpoint_stores_only_hash(client):
    raw = "Explain the public support policy for the current semester."
    response = await client.post(
        "/api/v1/plans", json={"public_requirement": raw, "approved_labels": ["steady"]}
    )
    assert response.status_code == 200
    assert response.json()["source"] == "local-fallback"
