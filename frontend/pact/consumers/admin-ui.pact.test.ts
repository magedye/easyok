import { describe, beforeAll, afterAll, it } from "vitest";
import axios from "axios";
import { pact } from "../pact.config";
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

describe("Feature Toggles Contract", () => {
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
});
