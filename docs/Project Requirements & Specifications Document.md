

# 📑 Project Requirements & Specifications Document

**Project Name:** EasyData / Vanna Enterprise Agent
**Version:** 1.0 (Final State Definition)
**Language:** English

## 1. System Overview

The system is an enterprise-grade **AI-powered Data Analyst Platform**. It serves as a secure middleware between non-technical business users and corporate databases (specifically Oracle/PostgreSQL). It utilizes RAG (Retrieval-Augmented Generation) to translate Natural Language questions (Arabic & English) into accurate SQL queries, execute them, and present results visually.

## 2. User Interface (UI) & User Experience (UX)

### 2.1 General Layout

* **Sidebar Navigation:** A persistent left sidebar containing:
* Organization Selector.
* **Dashboard:** For pinned metrics and high-level views.
* **New Chat:** Quick access to start querying (supporting multiple modes like V1/FSD).
* **Agent Management:** Tools for configuring the AI.
* **Integrations:** Connection hubs for external apps.
* **Database Connection:** Configuration for the target DB.
* **User Profile:** Settings and Sign out.


* **Language Support:** The UI must support full **RTL (Right-to-Left)** layout for Arabic users and LTR for English, with dynamic switching.

### 2.2 The Chat Interface (Core Feature)

The chat interface is the primary workspace and must support the following workflow:

1. **Input:** A text box accepting natural language questions in **Arabic** or **English**.
2. **Assumption Transparency:** Before or alongside the result, the AI must display "Assumptions" it made (e.g., *"When the user says 'first table', I assume they refer to tbltransactions"*).
* *Requirement:* Users must be able to click to add these assumptions to the agent's memory.


3. **Dual-View Results:**
* **Business View:** A generated chart (Bar, Line, Pie) and a natural language summary of the findings (e.g., *"The top 5 users by transaction value are..."*).
* **Technical View:** A collapsible section showing the generated **SQL Query** and raw **Data Table**.


4. **Visualization:** Automatic selection of the best chart type based on data topology:
* **Bar Chart:** For categorical comparisons (e.g., Transaction value per User).
* **Line Chart:** For time-series trends.
* **Pie Chart:** For distribution/percentages (e.g., Transactions by Doc Type).


5. **Feedback Loop:** Buttons for "Mark Valid" (adds to training data), "Retry", and "Pin" (saves to Dashboard).

### 2.3 Dashboard

* **Pinned Queries:** A personalized area where users can pin frequently used charts/queries from the chat interface for quick monitoring.
* **Agent Status:** Indicators of the agent's "Capability Level" (Basic, Learning, Capable, Advanced, Expert) based on the volume of training data.

## 3. Functional Requirements

### 3.1 AI & SQL Processing

* **Multilingual NLU:** The system must accurately interpret complex financial questions in Arabic (e.g., *"ماهو معدل قيمة المعاملات المالية"*) and English.
* **SQL Generation:**
* Support for complex operations: `JOIN`, `GROUP BY`, `CAST` (e.g., casting text amounts to DECIMAL), `ORDER BY`, and `LIMIT/FETCH FIRST`.
* Database Agnostic Logic: While the demo shows PostgreSQL syntax (`LIMIT`), the backend must adapt to the connected database dialect (specifically **Oracle** for the production environment).


* **Self-Correction:** If a query fails (e.g., syntax error), the agent should attempt to fix it before returning an error.

### 3.2 Training & Knowledge Management (The "Brain")

A dedicated "Agent Management" or "Training" section is required to manage the RAG context:

* **Training Data Types:** The system must accept and categorize training data into:
1. **SQL Pairs:** Verified Question <-> SQL pairs.
2. **Documentation:** Text/Markdown explaining business logic.
3. **DDL:** Schema definitions (CREATE TABLE statements).
4. **Schema:** Metadata about tables and columns.


* **Management UI:** A tabular view to:
* View all training items.
* Filter by type (SQL, DDL, Doc).
* **Delete** obsolete or incorrect training data.
* **Approve** pending training data derived from chat feedback.


* **Database Selection:** A UI to select specific tables and columns to "train" the AI on, preventing it from accessing irrelevant tables.

### 3.3 Database Connectivity

* **Connection Form:** A UI to input database credentials (Host, Port, DB Name, User, Password).
* **IP Whitelisting:** Display the application's IP to allow listing on the database firewall.
* **Supported Databases:** Primarily **Oracle** (per project code) and PostgreSQL (per screenshots).

## 4. Administrative & Security Requirements

### 4.1 User Management

* **Role-Based Access Control (RBAC):**
* **Agent Admin:** Full control over settings, users, and connections.
* **Agent Manager:** Can manage training data.
* **Agent User:** Can only chat/query.


* **User Invitation:** Ability to add users via email and assign roles.

### 4.2 Security Constraints (Hard Requirements)

* **Read-Only Architecture:** The system must strictly enforce `SELECT` only queries. No `INSERT`, `UPDATE`, or `DELETE` operations are allowed.
* **SQL Firewall:** A middleware layer to block malicious queries before execution.
* **Audit Logging:** All queries generated and executed must be logged for compliance.

## 5. Integrations

The system must support connecting the AI agent to external communication channels:

* **Microsoft Teams**
* **WhatsApp**
* **Slack**
* **ChatGPT** (Custom GPT integration)

## 6. Technical Stack (Inferred from Code & Docs)

* **Backend:** Python (FastAPI).
* **Frontend:** React (implied by the polished UI in screenshots) or Streamlit (for rapid prototyping phase).
* **AI Engine:** Vanna Framework (v2.0+).
* **LLM:** Groq (Llama 3.1) or OpenAI.
* **Vector DB:** ChromaDB (for storing training data embeddings).
* **Protocol:** Server-Sent Events (SSE) for streaming responses.

---

### Summary of Deliverable

The final product is a **secure, bilingual, self-learning SQL-AI Analyst** that allows organization members to visualize financial and operational data simply by asking questions in their native language, with a robust backend for admins to curate the AI's knowledge base.