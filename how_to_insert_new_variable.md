# How to Insert a New Environment Variable

This playbook lists the exact steps and required updates when adding a new environment variable to the EasyData project. Follow these steps in order to remain compliant with governance and to avoid runtime drift.

## 1) Choose a Name and Scope
- Use UPPER_SNAKE_CASE.
- Prefix by domain when possible (e.g., `VANNA_*`, `GROQ_*`, `DB_*`).
- Keep names concise and explicit. Avoid abbreviations that are not obvious.

## 2) Add to the Environment Templates (All of Them)
Edit the following files and add the variable under the correct section:
- `.env` (your active local config) — set the working value.
- `.env.example` (developer reference) — include placeholders or safe defaults.
- `.env.production` (production template) — use `>>> CHANGE ME <<<` for secrets.
- `env.md` (schema / documentation) — add under the appropriate section and, if present, the Settings snippet that mirrors `settings.py`.

## 3) Wire into Settings (SSOT)
- Add the variable to `app/core/settings.py` with an explicit type and default (if safe). Example:
  ```python
  NEW_FEATURE_ENABLED: bool = False
  ```
- Use the correct Literal/Optional types to match allowed values in env.md.
- If normalization or sanitization is needed, add a `@field_validator`.

## 4) Update Provider/Factory Logic (If Applicable)
- If the variable influences provider selection or configuration, update the relevant factory:
  - `app/providers/factory.py` for LLM/DB/vector providers.
  - Any service factory that consumes the variable should read from `settings`.
- Avoid `os.getenv` in business code; always rely on `settings`.

## 5) Consume via Settings Only
- In services (e.g., `app/services/*`, `app/core/*`, `main.py`), import from `app.core.config import settings` (or inject the Settings instance) rather than reading environment variables directly.
- Ensure defaults and fallback logic are centralized in `settings.py`.

## 6) Tests and Docs
- If the variable is used in connectivity/health tests, add it to relevant tests (e.g., `tests/test_llm_connection.py`, `tests/test_oracle_*`, etc.) via `.env` loading.
- If the variable affects routes or behavior, add/adjust tests in the appropriate suite (e.g., `tests/test_*` under api/services/governance).
- Update any developer docs that list required variables (`env.md` is primary; add a short note to README if user-facing).

## 7) Frontend Considerations (If Needed)
- If the frontend needs the variable, expose it via Vite’s `VITE_` prefix and add to `frontend` config files where appropriate.
- Do not leak secrets to the frontend; only expose non-sensitive values.

## 8) Validation Checklist
- Variable appears in: `.env`, `.env.example`, `.env.production`, `env.md`.
- Defined in `app/core/settings.py` with correct type/default and validators if needed.
- Referenced only via `settings` (no stray `os.getenv`).
- Related factories/services adjusted to consume the new setting.
- Tests updated or added if the variable affects runtime behavior.
- Docs reflect the new variable and its allowed values.

## 9) Secrets Handling
- Never commit real secrets to any template.
- In `.env.production`, mark secrets as `>>> CHANGE ME <<<`.
- In `.env.example`, use safe placeholders.

By following this checklist, new variables remain governed, documented, and correctly wired through the codebase without surprises.***
