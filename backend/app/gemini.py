import json

from google import genai
from google.genai import types

from .config import Settings
from .privacy import redact_sensitive_text
from .schemas import PlanRequest, ProofPlan


def local_plan() -> ProofPlan:
    return ProofPlan(
        title="What the Nightline proof says",
        plain_language_summary=(
            "A student produced one valid weekly support signal from local answers. "
            "Only the coarse support band and replay-safe nullifier become public."
        ),
        private_inputs=["Three 0–4 answers", "Student worker secret", "Private reflection"],
        public_outputs=["Support band", "One-use nullifier", "Finalized transaction"],
        verifier_note="Treat the band as an aggregate support signal, never as a diagnosis.",
        source="local-fallback",
    )


async def create_plan(request: PlanRequest, settings: Settings) -> ProofPlan:
    if not settings.gemini_api_key:
        return local_plan()

    safe_requirement = redact_sensitive_text(request.public_requirement)
    safe_labels = [redact_sensitive_text(label) for label in request.approved_labels]
    prompt = (
        "Explain this public zero-knowledge verification rule to a student in calm, "
        "plain language. Do not infer, request, or mention any identity, wallet address, "
        "exact answer, document, or secret.\n"
        f"Public rule: {safe_requirement}\nApproved public labels: {json.dumps(safe_labels)}"
    )
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ProofPlan,
                temperature=0.2,
            ),
        )
        parsed = ProofPlan.model_validate_json(response.text or "{}")
        return parsed.model_copy(update={"source": "gemini"})
    except Exception:
        return local_plan()
