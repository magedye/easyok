import { describe, beforeAll, afterAll, it } from "vitest";
import axios from "axios";
import { pact } from "./pact.config";
import { z } from "zod";

const FeatureToggleListResponse = z.object({
  features: z.array(
    z.object({
      name: z.string(),
      value: z.boolean(),
      mutable: z.boolean(),
    })
  ),
});

describe("Feature Toggles Admin Contracts", () => {
  beforeAll(() => pact.setup());
  afterAll(() => pact.finalize());

  it("returns governed feature toggles", async () => {
    await pact.addInteraction({
      state: "feature toggles exist",
      uponReceiving: "a request for feature toggles",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/settings/feature-toggles",
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          features: [{ name: "ENABLE_SEMANTIC_CACHE", value: true, mutable: true }],
        },
      },
    });

    const res = await axios.get(
      `${pact.mockService.baseUrl}/api/v1/admin/settings/feature-toggles`
    );
    FeatureToggleListResponse.parse(res.data);
  });

  it("requires reason and rejects immutable", async () => {
    await pact.addInteraction({
      state: "immutable toggle exists",
      uponReceiving: "a request to change immutable toggle",
      withRequest: {
        method: "POST",
        path: "/api/v1/admin/settings/feature-toggle",
        body: { feature: "AUTH_ENABLED", value: false, reason: "insufficient reason" },
      },
      willRespondWith: {
        status: 403,
        headers: { "Content-Type": "application/json" },
        body: {},
      },
    });

    const res = await axios.post(
      `${pact.mockService.baseUrl}/api/v1/admin/settings/feature-toggle`,
      { feature: "AUTH_ENABLED", value: false, reason: "insufficient reason" }
    );
    if (res.status !== 403) {
      throw new Error("expected 403 for immutable toggle");
    }
  });
});
