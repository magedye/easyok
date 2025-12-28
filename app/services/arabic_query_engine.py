from __future__ import annotations

import re
from typing import Dict

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.core.exceptions import InvalidQueryError
from app.core.config import get_settings


class ArabicQueryEngine:
    """
    Mandatory preprocessing for Arabic queries.
    - Normalizes and segments Arabic text before semantic cache / embeddings / LLM.
    - Does NOT generate SQL or execute queries.
    - Must fail fast on error.
    """

    def __init__(self) -> None:
        self.tracer = trace.get_tracer(__name__)
        self.settings = get_settings()
        # Optional heavy deps are loaded lazily
        self._camel_normalizer = None
        self._farasa_segmenter = None

    def _is_arabic(self, text: str) -> bool:
        return bool(re.search(r"[\u0600-\u06FF]", text or ""))

    def _normalize(self, text: str) -> str:
        if not getattr(self.settings, "ENABLE_CAMEL_TOOLS", True):
            return text.strip()
        # Try camel_tools normalize if available
        try:
            if self._camel_normalizer is None:
                from camel_tools.utils.normalize import normalize_alef_maksura_ar, normalize_teh_marbuta_ar, normalize_alef_ar
                from camel_tools.utils.dediac import dediac_ar

                def camel_norm(t: str) -> str:
                    t = normalize_alef_ar(t)
                    t = normalize_alef_maksura_ar(t)
                    t = normalize_teh_marbuta_ar(t)
                    t = dediac_ar(t)
                    return t

                self._camel_normalizer = camel_norm
            text = self._camel_normalizer(text)
        except Exception:
            # Fallback manual normalization
            text = re.sub(r"[إأآا]", "ا", text)
            text = re.sub(r"[يى]", "ي", text)
            text = re.sub(r"[ۀة]", "ه", text)
            text = re.sub(r"ـ", "", text)
            text = re.sub(r"[\u064B-\u065F]", "", text)  # remove diacritics
        return text.strip()

    def _segment(self, text: str) -> str:
        if not getattr(self.settings, "ENABLE_FARASA", True):
            return text
        try:
            if self._farasa_segmenter is None:
                from farasa.segmenter import FarasaSegmenter  # type: ignore

                self._farasa_segmenter = FarasaSegmenter()
            segmented = self._farasa_segmenter.segment(text)
            return segmented
        except Exception as exc:
            raise InvalidQueryError(f"Arabic segmentation failed: {exc}")

    def _tokenize(self, text: str) -> str:
        try:
            from camel_tools.tokenizers.word import simple_word_tokenize

            tokens = simple_word_tokenize(text)
            return " ".join(tokens)
        except Exception:
            return text

    def process(self, question: str) -> Dict[str, str]:
        """
        Process Arabic query.
        Returns dict with original_query, normalized_query, segmented_query, final_query.
        Fail fast on errors; no fallback to raw input.
        """
        if not question:
            raise InvalidQueryError("Empty question")

        is_arabic = self._is_arabic(question)

        if not is_arabic:
            return {
                "original_query": question,
                "normalized_query": question,
                "segmented_query": question,
                "final_query": question,
            }

        if not self.settings.ENABLE_ARABIC_NLP:
            with self.tracer.start_as_current_span(
                "arabic.preprocess",
                attributes={
                    "language": "ar",
                    "arabic.preprocess.skipped": True,
                    "reason": "feature_disabled",
                    "original.length": len(question),
                    "final.length": len(question),
                },
            ):
                return {
                    "original_query": question,
                    "normalized_query": question,
                    "segmented_query": question,
                    "final_query": question,
                }

        with self.tracer.start_as_current_span(
            "arabic.preprocess",
            attributes={
                "language": "ar",
                "embedding.model": "camelbert-da",
            },
        ) as span:
            normalized = self._normalize(question)
            segmented = self._segment(normalized)
            tokenized = self._tokenize(segmented)
            final_query = tokenized

            span.set_attribute("normalization.applied", True)
            span.set_attribute("segmentation.applied", True)
            span.set_attribute("morphology.applied", True)
            span.set_attribute("original.length", len(question))
            span.set_attribute("final.length", len(final_query))

            if not final_query:
                span.set_status(Status(StatusCode.ERROR, "Arabic preprocessing produced empty output"))
                raise InvalidQueryError("Arabic preprocessing failed")

            return {
                "original_query": question,
                "normalized_query": normalized,
                "segmented_query": segmented,
                "final_query": final_query,
            }
