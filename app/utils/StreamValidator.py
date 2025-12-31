import json
from typing import List, Dict, Any


class StreamValidationError(Exception):
    """Raised when a stream violates the NDJSON Governance Contract."""
    pass


class StreamValidator:
    """
    Canonical NDJSON Stream Validator.

    Enforces the binding contract defined in streaming.md
    and NDJSON_STREAMING_CONTRACT_TEST_CHECKLIST.md.
    """

    ALLOWED_TYPES = {
        "thinking",
        "technical_view",
        "data",
        "business_view",
        "error",
        "end",
    }

    def __init__(self, chunks: List[Dict[str, Any]]):
        if not chunks:
            raise StreamValidationError(
                "Contract Violation: Stream is empty."
            )
        self.chunks = chunks

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def validate_all(self) -> bool:
        self._check_base_schema()
        self._check_trace_id_consistency()
        self._check_first_chunk()
        self._check_single_error()
        self._check_terminal_sequence()
        self._check_no_data_after_error()
        self._check_end_chunk_integrity()
        return True

    # ------------------------------------------------------------------ #
    # Contract Checks
    # ------------------------------------------------------------------ #

    def _check_base_schema(self):
        """Every chunk must have type, trace_id, timestamp, payload."""
        for i, chunk in enumerate(self.chunks):
            for field in ("type", "trace_id", "timestamp", "payload"):
                if field not in chunk:
                    raise StreamValidationError(
                        f"Contract Violation: Missing '{field}' "
                        f"in chunk index {i}."
                    )

            ctype = chunk.get("type")
            if ctype not in self.ALLOWED_TYPES:
                raise StreamValidationError(
                    f"Contract Violation: Invalid chunk type '{ctype}'."
                )

    def _check_trace_id_consistency(self):
        """All chunks must share the same trace_id."""
        trace_ids = {c["trace_id"] for c in self.chunks}
        if len(trace_ids) != 1:
            raise StreamValidationError(
                f"Contract Violation: Inconsistent trace_id values: {trace_ids}"
            )

    def _check_first_chunk(self):
        """First chunk must be THINKING."""
        if self.chunks[0]["type"] != "thinking":
            raise StreamValidationError(
                f"Contract Violation: First chunk is "
                f"'{self.chunks[0]['type']}', expected 'thinking'."
            )

    def _check_single_error(self):
        """At most one ERROR chunk is allowed."""
        errors = [c for c in self.chunks if c["type"] == "error"]
        if len(errors) > 1:
            raise StreamValidationError(
                "Contract Violation: More than one ERROR chunk found."
            )

    def _check_terminal_sequence(self):
        """END must exist exactly once and be the last chunk."""
        end_indices = [
            i for i, c in enumerate(self.chunks) if c["type"] == "end"
        ]
        if len(end_indices) != 1:
            raise StreamValidationError(
                f"Contract Violation: Expected exactly one END chunk, "
                f"found {len(end_indices)}."
            )

        if end_indices[0] != len(self.chunks) - 1:
            raise StreamValidationError(
                "Contract Violation: END chunk is not the last chunk."
            )

    def _check_no_data_after_error(self):
        """After ERROR, only END is allowed."""
        for i, chunk in enumerate(self.chunks):
            if chunk["type"] == "error":
                remaining = self.chunks[i + 1 :]
                if len(remaining) != 1:
                    raise StreamValidationError(
                        "Contract Violation: ERROR must be followed "
                        "by exactly one END chunk."
                    )
                if remaining[0]["type"] != "end":
                    raise StreamValidationError(
                        f"Contract Violation: Chunk '{remaining[0]['type']}' "
                        "found after ERROR, expected 'end'."
                    )
                break

    def _check_end_chunk_integrity(self):
        """END.status must reflect success or failure correctly."""
        end_chunk = self.chunks[-1]
        payload = end_chunk.get("payload", {})
        status = payload.get("status")

        error_present = any(c["type"] == "error" for c in self.chunks)

        if error_present and status != "failed":
            raise StreamValidationError(
                f"Contract Violation: ERROR present but END status "
                f"is '{status}', expected 'failed'."
            )

        if not error_present and status != "success":
            raise StreamValidationError(
                f"Contract Violation: No ERROR present but END status "
                f"is '{status}', expected 'success'."
            )

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @classmethod
    def from_response(cls, response_text: str):
        """Parse raw NDJSON response text into a validated StreamValidator."""
        try:
            lines = [
                line for line in response_text.splitlines()
                if line.strip()
            ]
            chunks = [json.loads(line) for line in lines]
            return cls(chunks)
        except json.JSONDecodeError as exc:
            raise StreamValidationError(
                f"Protocol Violation: Malformed JSON chunk: {exc}"
            ) from exc
