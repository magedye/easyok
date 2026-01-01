# Frontend Tier 2 UI Kit

This folder holds the Tier 2 “Vanna Native” assistant UI extensions built with [`@assistant-ui/react`](https://github.com/assistant-ui/assistant-ui). The goal is to visualize Agent tool calls (`run_sql`, `visualize_data`, etc.) coming from `/api/v2/vanna/agent` using custom components (tool UIs) instead of plain text blocks.

## Structure

- `src/ToolUIs.tsx`: React hooks that register Tool UIs (via `makeAssistantToolUI`) for Tier 2 tools.
- `src/AssistantFrame.tsx`: Example embedding of `AssistantRuntimeProvider` + thread components with the custom Tool UIs.

## How to integrate

1. Install dependencies (example or monorepo):
   ```sh
   cd frontend_tier2
   npm install @assistant-ui/react zod
   ```
2. Mount `AssistantRuntimeProvider` with the runtime you already use (MCP/AI SDK). Within that provider, import the tool UI hooks from `src/ToolUIs.tsx`.
3. Use `Thread` or `AssistantModal` components inside your layout; the tool UIs will automatically render whenever the backend returns a `tool_call` for the registered `toolName`.

## Running locally

This folder is independent; copy `src/ToolUIs.tsx` into your existing front end or import it from here. It purposely avoids bundler config so it can be dropped into `frontend/`.

