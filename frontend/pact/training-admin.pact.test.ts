import { describe, beforeAll, afterAll, it } from "vitest";
import axios from "axios";
import { pact } from "./pact.config";
import { z } from "zod";

const TrainingItem = z.object({
  id: z.number().int(),
  question: z.string(),
  schema_version: z.string(),
  policy_version: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  status: z.string(),
});

const TrainingItemsResponse = z.object({
  items: z.array(TrainingItem),
});

const MetricsResponse = z.object({
  baseline: z.object({}).partial().passthrough(),
  post_training: z.object({}).partial().passthrough(),
});

describe("Training Admin Contracts", () => {
  beforeAll(() => pact.setup());
  afterAll(() => pact.finalize());

  it("returns training items list", async () => {
    await pact.addInteraction({
      state: "training items exist",
      uponReceiving: "a request for training items",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/training/items",
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          items: [
            {
              id: 1,
              question: "Q",
              schema_version: "v1",
              policy_version: "p1",
              created_by: "admin",
              created_at: "2025-01-01T00:00:00Z",
              status: "pending",
            },
          ],
        },
      },
    });
    const res = await axios.get(`${pact.mockService.baseUrl}/api/v1/admin/training/items`);
    TrainingItemsResponse.parse(res.data);
  });

  it("approve requires reason", async () => {
    await pact.addInteraction({
      state: "pending item exists",
      uponReceiving: "an approve request with reason",
      withRequest: {
        method: "POST",
        path: "/api/v1/admin/training/1/approve",
        body: { reason: "valid reason text" },
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { training_item_id: 1, status: "approved" },
      },
    });
    const res = await axios.post(
      `${pact.mockService.baseUrl}/api/v1/admin/training/1/approve`,
      { reason: "valid reason text" }
    );
    if (res.status !== 200) {
      throw new Error("expected approve to succeed");
    }
  });

  it("reject requires reason", async () => {
    await pact.addInteraction({
      state: "pending item exists",
      uponReceiving: "a reject request with reason",
      withRequest: {
        method: "POST",
        path: "/api/v1/admin/training/1/reject",
        body: { reason: "valid reason text" },
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { status: "rejected" },
      },
    });
    const res = await axios.post(
      `${pact.mockService.baseUrl}/api/v1/admin/training/1/reject`,
      { reason: "valid reason text" }
    );
    if (res.status !== 200) {
      throw new Error("expected reject to succeed");
    }
  });

  it("returns metrics read-only", async () => {
    await pact.addInteraction({
      state: "metrics available",
      uponReceiving: "a request for training metrics",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/training/metrics",
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          baseline: { percentage_correct_first_pass: 70 },
          post_training: { percentage_correct_first_pass: 85 },
        },
      },
    });
    const res = await axios.get(`${pact.mockService.baseUrl}/api/v1/admin/training/metrics`);
    MetricsResponse.parse(res.data);
  });
});
