import { generateZodClientFromOpenAPI } from "openapi-zod-client";
import path from "path";
import fs from "fs";

const openapiPath = path.resolve(__dirname, "../openapi.json");
const openApiDoc = JSON.parse(fs.readFileSync(openapiPath, "utf8"));

const distPath = path.resolve(__dirname, "../src/api/generated/client.ts");

generateZodClientFromOpenAPI({
  openApiDoc,
  distPath,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
