import { describe, beforeAll, afterAll, it } from "vitest";
import axios from "axios";
import { pact } from "../pact.config";
import { z } from "zod";

const SentryIssuesResponse = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      trace_id: z.string().optional(),
      lastSeen: z.string().optional(),
    })
  ),
});

describe("Sentry Issues Contract", () => {
  beforeAll(() => pact.setup());
  afterAll(() => pact.finalize());

  it("returns recent Sentry issues", async () => {
    await pact.addInteraction({
      state: "sentry issues exist",
      uponReceiving: "a request for sentry issues",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/settings/sentry-issues",
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          issues: [
            { id: "1", title: "Error", trace_id: "abc", lastSeen: "2025-01-01T00:00:00Z" },
          ],
        },
      },
    });

    const res = await axios.get(
      `${pact.mockService.baseUrl}/api/v1/admin/settings/sentry-issues`
    );
    SentryIssuesResponse.parse(res.data);
  });
});
