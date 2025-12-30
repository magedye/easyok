#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# EasyData — Frontend SDK Generation (Governance-Safe)
# =============================================================================

API_URL_DEFAULT="http://localhost:8000/openapi.json"
API_URL="${API_URL:-$API_URL_DEFAULT}"

OUTPUT_DIR="frontend/src/api/generated"
TMP_SPEC="/tmp/easydata_openapi.json"

echo "🛡️ EasyData SDK Generation — Governance Mode"
echo "🔗 OpenAPI Source: $API_URL"

# -----------------------------------------------------------------------------
# 1. Preflight: Ensure backend is reachable
# -----------------------------------------------------------------------------
echo "🔍 Checking backend availability..."
if ! curl -fsS "$API_URL" > "$TMP_SPEC"; then
  echo "❌ ERROR: Unable to fetch OpenAPI spec from backend."
  echo "   Is the backend running and accessible?"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Validate OpenAPI size (basic corruption guard)
# -----------------------------------------------------------------------------
SPEC_SIZE=$(wc -c < "$TMP_SPEC")
if [ "$SPEC_SIZE" -lt 1000 ]; then
  echo "❌ ERROR: OpenAPI spec looks invalid or too small ($SPEC_SIZE bytes)."
  echo "   Refusing to generate SDK from a broken contract."
  exit 1
fi

# -----------------------------------------------------------------------------
# 3. Optional: Spectral validation (if available)
# -----------------------------------------------------------------------------
if command -v npx >/dev/null 2>&1; then
  if npx --yes @stoplight/spectral-cli lint "$TMP_SPEC" >/dev/null 2>&1; then
    echo "✅ OpenAPI contract validation passed"
  else
    echo "❌ ERROR: OpenAPI contract validation failed"
    echo "   Fix contract violations before generating SDK."
    exit 1
  fi
else
  echo "⚠️ WARN: Spectral not available, skipping contract lint"
fi

# -----------------------------------------------------------------------------
# 4. Clean previous generated SDK
# -----------------------------------------------------------------------------
echo "🧹 Cleaning previous generated SDK..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# -----------------------------------------------------------------------------
# 5. Generate SDK
# -----------------------------------------------------------------------------
echo "🚀 Generating EasyData Frontend SDK..."
npx openapi-typescript-codegen \
  --input "$TMP_SPEC" \
  --output "$OUTPUT_DIR" \
  --client axios \
  --useOptions \
  --exportSchemas

# -----------------------------------------------------------------------------
# 6. Post-check
# -----------------------------------------------------------------------------
if [ ! -f "$OUTPUT_DIR/index.ts" ]; then
  echo "❌ ERROR: SDK generation failed — index.ts not found"
  exit 1
fi

echo "✅ SDK generated successfully"
echo "📁 Output: $OUTPUT_DIR"

# -----------------------------------------------------------------------------
# 7. Cleanup
# -----------------------------------------------------------------------------
rm -f "$TMP_SPEC"

echo "🛡️ SDK generation completed under governance control"
