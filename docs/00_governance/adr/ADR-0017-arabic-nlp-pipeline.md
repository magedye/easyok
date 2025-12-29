# ADR-0017: Arabic NLP Pipeline (Normalization → Segmentation → Tokenization)

## Status
Accepted – v16.7

## Context
Arabic input caused inconsistent semantic similarity, cache misses, and reduced SQL accuracy. Orthographic and morphological variance (alef/ya/hamza, clitics, diacritics) required a governed preprocessing layer before embeddings, semantic cache, and LLM/SQL generation.

## Decision
Adopt a deterministic Arabic NLP pipeline:
- **Normalization** (CAMeL Tools): normalize alef/ya/hamza, remove tatweel and diacritics.
- **Segmentation** (Farasa): split clitics/prefixes.
- **Tokenization** (CAMeL Tools): produce final standardized text for embeddings and cache.
- Emit OpenTelemetry span `arabic.preprocess` with mandatory attributes.
- Fail fast on errors; never fall back to raw input.
- Pipeline must run for Arabic input before semantic cache and LLM.

## Alternatives Considered
- Raw input to embeddings/LLM: rejected (unstable similarity/accuracy).
- Lightweight regex-only normalization: rejected (insufficient for morphology/clitics).
- Different libraries (spacy, nltk): rejected for weaker Arabic support and higher drift risk.

## Consequences
- Improved cache hit ratio and embedding stability for Arabic.
- Deterministic preprocessing adds predictable latency but guards correctness.
- Dependency on CAMeL Tools and Farasa; must be present in runtime image.
