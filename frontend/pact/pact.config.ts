import { Pact } from "@pact-foundation/pact";
import path from "path";

export const pact = new Pact({
  consumer: "easydata-admin-ui",
  provider: "easydata-backend",
  port: 1234,
  dir: path.resolve(process.cwd(), "pact/contracts"),
});
