import { EasyDataClient } from "./client";
import { NDJSONChunk } from "./types";

export async function exampleUsage(jwtToken: string) {
  const client = new EasyDataClient(
    "https://api.easydata.local",
    jwtToken
  );

  for await (const chunk of client.ask({
    question: "Total revenue by region last quarter",
    stream: true,
  })) {
    switch (chunk.type) {
      case "thinking":
        console.log("Thinking:", chunk.status);
        break;
      case "technical_view":
        console.log("SQL:", chunk.sql);
        break;
      case "data_chunk":
        // renderTable(chunk.columns, chunk.rows);
        console.log("Data chunk:", chunk.columns.length, "cols", chunk.row_count, "rows");
        break;
      case "business_view":
        // renderChart(chunk.chart_config);
        console.log("Business view:", chunk.summary);
        break;
      case "end":
        console.log("Done in", chunk.duration_ms);
        break;
      case "error":
        console.error("Error:", chunk.message);
        break;
    }
  }
}
