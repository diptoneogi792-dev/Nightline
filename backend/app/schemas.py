from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PRIVATE_FIELD_FRAGMENTS = {
    "private",
    "secret",
    "seed",
    "credential",
    "identity_document",
    "raw_response",
    "exact_answer",
    "salary",
    "vote",
    "bid",
    "note",
    "wallet_address",
    "witness",
}


def find_private_field(value: Any, path: str = "payload") -> str | None:
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = str(key).lower().replace("-", "_")
            if any(fragment in normalized for fragment in PRIVATE_FIELD_FRAGMENTS):
                return f"{path}.{key}"
            found = find_private_field(nested, f"{path}.{key}")
            if found:
                return found
    if isinstance(value, list):
        for index, nested in enumerate(value):
            found = find_private_field(nested, f"{path}[{index}]")
            if found:
                return found
    return None


class PublicReceiptCreate(BaseModel):
    network: Literal["preview", "preprod"]
    worker_contract_address: str = Field(min_length=32, max_length=128)
    deployment_tx_hash: str = Field(min_length=32, max_length=128)
    pulse_tx_hash: str = Field(min_length=32, max_length=128)
    signal_band: Literal["steady", "stretched", "urgent"]
    disclosure_scope: list[str] = Field(min_length=1, max_length=8)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def reject_private_fields(cls, value: Any) -> Any:
        field = find_private_field(value)
        if field:
            raise ValueError(f"Private field rejected at {field}")
        return value

    @field_validator("worker_contract_address", "deployment_tx_hash", "pulse_tx_hash")
    @classmethod
    def only_public_identifier_characters(cls, value: str) -> str:
        if not all(character.isalnum() or character in "_-" for character in value):
            raise ValueError("Identifier contains unsupported characters")
        return value


class ReceiptResponse(BaseModel):
    id: str
    accepted: bool = True


class MetricsResponse(BaseModel):
    total_proofs: int
    unique_workers: int
    steady: int
    stretched: int
    urgent: int


class PlanRequest(BaseModel):
    public_requirement: str = Field(min_length=12, max_length=2000)
    approved_labels: list[str] = Field(min_length=1, max_length=12)

    model_config = ConfigDict(extra="forbid")


class ProofPlan(BaseModel):
    title: str
    plain_language_summary: str
    private_inputs: list[str]
    public_outputs: list[str]
    verifier_note: str
    source: Literal["gemini", "local-fallback"] = "local-fallback"


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["ready"]
    gemini: Literal["configured", "fallback"]
