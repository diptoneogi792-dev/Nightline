import re

REDACTION_PATTERNS = [
    (re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE), "<redacted-email>"),
    (re.compile(r"\b(?:\d[ -]*?){12,19}\b"), "<redacted-number>"),
    (re.compile(r"\b(?:mn_addr|mn_shield-addr|mn_dust)[a-zA-Z0-9_]+\b"), "<redacted-address>"),
    (re.compile(r"\b(?:[a-z]+\s+){11,23}[a-z]+\b", re.IGNORECASE), "<redacted-phrase>"),
]


def redact_sensitive_text(value: str) -> str:
    redacted = value
    for pattern, replacement in REDACTION_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted
