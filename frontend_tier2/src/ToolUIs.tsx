import { makeAssistantToolUI } from "@assistant-ui/react";

type RunSqlArgs = {
  sql: string;
};

type RunSqlResult = {
  rows: Array<Record<string, unknown>>;
  columns: string[];
  row_count: number;
  summary?: string;
};

export const RunSqlToolUI = makeAssistantToolUI<RunSqlArgs, RunSqlResult>({
  toolName: "run_sql",
  render: ({ args, status, result }) => {
    if (status.type === "running") {
      return (
        <div className="run-sql-ui loading">
          <p>Executing SQL: <code>{args.sql}</code></p>
          <span>Fetching rows…</span>
        </div>
      );
    }
    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="run-sql-ui error">
          <h3>Error running query</h3>
          <p>{status.error}</p>
        </div>
      );
    }
    if (!result) {
      return null;
    }

    return (
      <div className="run-sql-ui success">
        <div className="header">
          <strong>Query result</strong>
          <span>{result.row_count} row(s)</span>
        </div>
        <div className="sql">
          <code>{args.sql}</code>
        </div>
        <div className="summary">{result.summary || "Agent generated result"}</div>
        <div className="table">
          <div className="columns">{result.columns.join(", ")}</div>
          <div className="rows">
            {result.rows.slice(0, 3).map((row, index) => (
              <pre key={index}>{JSON.stringify(row, null, 2)}</pre>
            ))}
          </div>
        </div>
      </div>
    );
  },
});

type VisualizeArgs = {
  filename: string;
};

type VisualizeResult = {
  chart: {
    chart_type: string;
    data: unknown;
  };
};

export const VisualizeToolUI = makeAssistantToolUI<VisualizeArgs, VisualizeResult>({
  toolName: "visualize_data",
  render: ({ status, result }) => {
    if (status.type === "running") {
      return <div>Generating visualization…</div>;
    }
    if (!result) {
      return null;
    }
    return (
      <div className="visualize-tool-ui">
        <h3>Visualization</h3>
        <p>Type: {result.chart.chart_type}</p>
        <pre>{JSON.stringify(result.chart.data, null, 2)}</pre>
      </div>
    );
  },
});
