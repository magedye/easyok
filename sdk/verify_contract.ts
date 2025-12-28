/* =========================================================
 * EasyData v16.7.9 – Contract Verification Script
 * ---------------------------------------------------------
 * This script validates runtime compliance with:
 * - OpenAPI final.yaml
 * - NDJSON streaming contract
 * - Confidence Tier rules
 * - Chunk ordering rules
 * ========================================================= */

import { EasyDataClient } from "./client";
import { NDJSONChunk } from "./types";

const API_BASE_URL = process.env.EASYDATA_API_URL!;
const API_TOKEN = process.env.EASYDATA_API_TOKEN!;

/* ---------------------------------------------------------
 * Hard Assertions (Do NOT modify)
 * --------------------------------------------------------- */

const ALLOWED_CHUNK_TYPES = [
  "thinking",
  "technical_view",
  "data_chunk",
  "business_view",
  "end",
  "error",
] as const;

const ALLOWED_TIERS = [
  "TIER_0_FORTRESS",
  "TIER_1_LAB",
] as const;

type ChunkType = typeof ALLOWED_CHUNK_TYPES[number];

/* ---------------------------------------------------------
 * Utilities
 * --------------------------------------------------------- */

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ CONTRACT VIOLATION:", message);
    process.exit(1);
  }
}

function assertChunkBase(chunk: NDJSONChunk) {
  assert(!!chunk.type, "Missing chunk.type");
  assert(ALLOWED_CHUNK_TYPES.includes(chunk.type as ChunkType),
    `Invalid chunk.type: ${chunk.type}`);

  assert(!!chunk.trace_id, "Missing trace_id");
  assert(!!chunk.timestamp, "Missing timestamp");

  assert(
    ALLOWED_TIERS.includes(chunk.confidence_tier),
    `Invalid confidence_tier: ${chunk.confidence_tier}`
  );
}

/* ---------------------------------------------------------
 * Chunk Order Rules
 * --------------------------------------------------------- */

const VALID_SEQUENCE: ChunkType[] = [
  "thinking",
  "technical_view",
  "data_chunk",
  "business_view",
  "end",
];

function isValidOrder(previous: ChunkType | null, current: ChunkType): boolean {
  if (!previous) return current === "thinking";
  return (
    VALID_SEQUENCE.indexOf(current) >=
    VALID_SEQUENCE.indexOf(previous)
  );
}

/* ---------------------------------------------------------
 * Main Verification
 * --------------------------------------------------------- */

async function verifyAskEndpoint() {
  console.log("🔍 Verifying /api/v1/ask NDJSON contract…");

  const client = new EasyDataClient(API_BASE_URL, API_TOKEN);

  let lastChunkType: ChunkType | null = null;
  let seenEnd = false;

  for await (const chunk of client.ask({
    question: "contract verification test",
    stream: true,
  })) {
    // Base schema check
    assertChunkBase(chunk);

    // Ordering check
    assert(
      isValidOrder(lastChunkType, chunk.type),
      `Invalid chunk order: ${lastChunkType} → ${chunk.type}`
    );

    // Tier rules
    if (chunk.type === "technical_view" || chunk.type === "data_chunk") {
      assert(
        chunk.confidence_tier === "TIER_0_FORTRESS",
        `${chunk.type} must be TIER_0_FORTRESS`
      );
    }

    if (chunk.type === "thinking" || chunk.type === "business_view") {
      assert(
        chunk.confidence_tier === "TIER_1_LAB",
        `${chunk.type} must be TIER_1_LAB`
      );
    }

    // Terminal rules
    if (chunk.type === "end" || chunk.type === "error") {
      seenEnd = true;
      break;
    }

    lastChunkType = chunk.type;
  }

  assert(seenEnd, "Stream ended without terminal chunk (end/error)");

  console.log("✅ /api/v1/ask contract verified");
}

/* ---------------------------------------------------------
 * Entry Point
 * --------------------------------------------------------- */

(async function main() {
  assert(!!API_BASE_URL, "EASYDATA_API_URL not set");
  assert(!!API_TOKEN, "EASYDATA_API_TOKEN not set");

  await verifyAskEndpoint();

  console.log("🎉 ALL CONTRACT CHECKS PASSED");
})();
