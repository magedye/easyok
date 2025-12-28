import { describe, beforeAll, afterAll, it } from "vitest";
import axios from "axios";
import { pact } from "../pact.config";
import { z } from "zod";

const ObservabilityStatus = z.object({
  semantic_cache: z.enum(["enabled", "disabled", "noop"]),
  arabic_nlp: z.enum(["enabled", "bypassed"]),
  alerts: z.enum(["enabled", "muted"]),
});

describe("Observability Status Contract", () => {
  beforeAll(() => pact.setup());
  afterAll(() => pact.finalize());

  it("returns span-derived observability status", async () => {
    await pact.addInteraction({
      state: "observability status available",
      uponReceiving: "a request for observability status",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/observability/status",
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          semantic_cache: "enabled",
          arabic_nlp: "enabled",
          alerts: "enabled",
        },
      },
    });

    const res = await axios.get(
      `${pact.mockService.baseUrl}/api/v1/admin/observability/status`
    );
    ObservabilityStatus.parse(res.data);
  });
});
