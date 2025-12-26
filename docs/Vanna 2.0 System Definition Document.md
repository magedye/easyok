Here is the comprehensive **Vanna 2.0 System Definition Document**, rewritten in English. It has been refined to stand alone without external file references and includes an expanded, detailed breakdown of the workflow logic as requested.

---

# 📘 System Definition Document: Vanna 2.0 (Framework Architecture)

## 1. Overview

Vanna 2.0 is not merely a SQL generation tool; it is a comprehensive **Framework for User-Aware AI Agents**. It is architected as a "Web-First" solution, leveraging modern web protocols (like Server-Sent Events) to seamlessly integrate intelligent data agents into existing enterprise applications. Its core philosophy revolves around understanding *who* the user is to deliver secure, personalized, and context-aware data insights.

## 2. Architecture Stack

The system is built upon three distinct, interconnected layers designed for modularity and security.

### A. Frontend Layer (The Interface)

* **Vanna Chat Web Component:** A customizable, drop-in UI element (`<vanna-chat>`) that can be embedded into any modern web application (React, Vue, Angular, etc.).
* **Context Propagation:** It automatically captures and transmits the user's existing session context—such as Cookies, JWTs, and authentication headers—to the backend. This ensures the AI agent operates within the authenticated user's scope without needing a separate login flow.

### B. Python Server Layer (The Engine)

* **Server Implementation:** The framework is agnostic but optimized for **FastAPI** or **Flask**. It acts as the bridge between the UI and the AI logic.
* **Communication Protocol:** Unlike traditional REST APIs that return a single payload, Vanna relies on **SSE (Server-Sent Events)** or WebSockets. This enables a real-time streaming experience where data tables, charts, and textual summaries are pushed to the client step-by-step as they are generated.

### C. User-Aware Agent Layer (The Brain)

This layer contains the core logic that differentiates Vanna from standard chatbots:

1. **User Resolver:** A critical component that interprets the authentication tokens to determine:
* **Identity:** Who is the user? (e.g., "Alice").
* **Roles:** What group do they belong to? (e.g., "Admin", "Analyst", "Viewer").
* **Data Access:** What specific data rows or columns are they permitted to see? (Row-Level Security).


2. **Dynamic System Prompt:** The instructions sent to the Large Language Model (LLM) are not static. They are dynamically constructed at runtime based on the resolved user identity, their permissions, and the specific tools available to them.
3. **Intelligent Tools:** The agent is equipped with "User-Aware" tools:
* **Run SQL:** Executes queries against connected databases (Snowflake, Postgres, BigQuery, Oracle, etc.).
* **Tool Memory:** A vector database for storing and retrieving past successful queries (RAG).
* **Charts:** A visualization engine (using libraries like Plotly) to generate graphs.



---

## 3. Detailed Workflow Logic

The core power of Vanna 2.0 lies in its sophisticated decision-making process. The workflow transitions from a user's natural language question to a final result through a multi-branch logic flow.

### Phase 1: Context Retrieval & Strategy Selection ( The RAG Brain)

When a user submits a question (e.g., "Show me Q4 sales"), the system does not immediately guess SQL code. Instead, it consults its **Tool Memory** (Vector Database).

* **Step 1: Semantic Search:** The agent searches the vector store for similar questions asked in the past.
* **Step 2: The Decision Branch:**
* **Path A: The "Similar Pattern" Route (Fast & Reliable)**
* If a highly similar question is found (e.g., "Show me Q3 sales"), the system identifies it as a **"Similar Pattern Found"**.
* **Adaptation:** The agent retrieves the verified SQL from the memory and *adapts* it to the new context (changing the date range from Q3 to Q4).
* **Execution:** It executes this variant directly.


* **Path B: The "Novel Question" Route (Deep Reasoning)**
* If no match is found, the system flags it as a **"Novel Question"**.
* **Deep Investigation:** The agent performs a deeper analysis of the database schema (DDL), table descriptions, and available documentation.
* **Generation:** It constructs a brand-new SQL query from scratch based on this analysis.
* **Verification & Learning:** After execution, if the query is successful, it is **saved back to Tool Memory**. This creates a continuous learning loop, turning a "Novel Question" into a "Similar Pattern" for future users.





### Phase 2: Secure Execution (Row-Level Security)

Once the SQL is generated (either via adaptation or new generation), it passes to the execution layer.

1. **User Context Injection:** The User Resolver passes the user's specific permissions to the execution tool.
2. **Security Application:** The database applies **Row-Level Security (RLS)**. For example, if a regional manager asks for "total sales," the query executes, but the database ensures they only receive data rows pertinent to their specific region.
3. **Result Filtering:** The raw data returned is strictly what that specific authenticated user is allowed to see.

### Phase 3: Progressive Response Streaming

To ensure a responsive user experience, results are streamed back to the frontend in a specific sequence rather than waiting for the entire process to finish:

1. **Stream 1: Data Table:** The raw data rows are sent first so the user can see the numbers immediately.
2. **Stream 2: Visualization:** The system determines the best chart type (Bar, Line, Pie) based on the data shape and streams the chart configuration.
3. **Stream 3: Summary:** Finally, the LLM analyzes the data trends and streams a concise natural language summary and business insight.

---

## 4. Key Capabilities & Features

* **Self-Learning (Auto-Training):** The system's accuracy improves with use. Every successful "Novel Question" expands the knowledge base, reducing hallucination rates over time.
* **LLM Agnostic:** The framework is designed to work with various models (GPT-4, Claude 3.5, Llama 3, etc.), allowing organizations to switch models without rebuilding the infrastructure.
* **Enterprise Observability:**
* **Audit Logs:** Tracks exactly who asked what and what data was shown.
* **Rate Limiting:** Prevents abuse by limiting queries per user/IP.
* **Evaluations:** Mechanisms to score and monitor the quality of SQL generation.


* **Connection Stability:** Built-in mechanisms to handle database timeouts and connection pooling (e.g., handling 500 errors or connection drops gracefully).

This architecture ensures that Vanna 2.0 is secure enough for enterprise data while remaining flexible enough for rapid development and deployment.