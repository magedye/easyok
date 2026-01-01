import React from "react";
import {
  AssistantRuntimeProvider,
  Thread,
  ThreadList,
  AssistantSidebar,
  Attachment,
  Markdown,
} from "@assistant-ui/react";
import { RunSqlToolUI, VisualizeToolUI } from "./ToolUIs";

/**
  Tier 2 Assistant Frame using assistant-ui.
  Expects a runtime that targets /api/v2/vanna/agent.
*/
export function Tier2AssistantFrame({
  runtime,
}: {
  runtime: Parameters<typeof AssistantRuntimeProvider>[0]["runtime"];
}) {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="tier2-assistant grid grid-cols-12 gap-4">
        <aside className="col-span-3">
          <AssistantSidebar />
          <ThreadList />
        </aside>
        <main className="col-span-9 border rounded-lg p-4 bg-white shadow-sm">
          <Thread
            components={{
              Attachment,
              Markdown,
            }}
          />
        </main>
      </div>
      <RunSqlToolUI />
      <VisualizeToolUI />
    </AssistantRuntimeProvider>
  );
}

export default Tier2AssistantFrame;
