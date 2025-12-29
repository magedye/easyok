#!/bin/bash
echo "🚀 Generating EasyData SDK from OpenAPI spec..."
npx openapi-typescript-codegen \
  --input frontend/openapi.json \
  --output frontend/src/api/generated \
  --client axios
echo "✅ SDK Generated successfully in frontend/src/api/generated"
