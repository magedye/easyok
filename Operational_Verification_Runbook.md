🛡️ EasyData — Operational Verification Runbook  
Frontend Operational Enablement Gate (Step-by-Step)  

Objective  
To confirm that the operational interface works end-to-end, specifically verifying that it:  
- Consumes streaming chunks in the correct constitutional order.  
- Manages feedback and training strictly through the governance pipeline.  
- Contains zero intelligence logic (No Intelligence in UI).  
- Is ready for adoption as the primary system operating tool.  

0) Preparation  
0.1 Configuration Audit  
Open the backend configuration (.env) and verify:  
- AUTH_ENABLED=false & RBAC_ENABLED=false.  
- STREAM_PROTOCOL=ndjson (or sse if applicable).  
- VECTOR_STORE_PATH=./data/vectorstore.  
PASS: Configuration is correct and backend is reachable.  
FAIL: Backend is unreachable or configuration is mismatched.  

0.2 Service Launch  
- Start the backend service.  
- Start the frontend: npm --prefix frontend run dev.  
- Navigate to http://localhost:5173.  
PASS: UI loads without errors.  
FAIL: Build errors or "White Screen of Death."  

1) Streaming Path Verification (Chat)  
1.1 Submit Query  
- Open the Chat page.  
- Enter a structural query: "How many tables in MAJED schema?".  
1.2 Verify Chunk Sequence  
Observe the UI rendering and ensure chunks appear in this exact order:  
- technical_view (SQL + Assumptions + Is_Safe).  
- data or error.  
- chart (if applicable).  
- summary (Arabic).  
PASS: technical_view arrives first; no reordering; streamed chunks (not a single JSON blob).  
FAIL: Data appears before technical view; missing chunks; UI "re-interprets" the response.  

2) Assumptions Review Panel  
2.1 Assumption Display  
Verify the displayed assumptions match the backend raw output exactly (text and intent).  
2.2 Submit Feedback  
Click "Mark Incorrect" on an assumption.  
Add a brief clarification note and submit.  
PASS: Feedback sent without automatic training; no UI-side text "correction".  
FAIL: UI modifies assumptions before sending; UI triggers automatic approval/training.  

3) Feedback → Training Flow (Governed)  
3.1 Open Operational Console  
- Navigate to Operations Console via the NavBar.  
3.2 Verify Pending Items  
- Open the Feedback/Training Console.  
- Locate the training item linked to your submitted feedback.  
PASS: New item appears as pending; no vector store injection before approval.  
FAIL: Item is missing; item was automatically "Approved" or "Trained".  

4) Training Management UI  
4.1 Upload DDL & Question/SQL Pairs  
- Upload a sample DDL or a Q/SQL pair via the Training Management tab.  
PASS: All items enter pending state; no automatic training.  
FAIL: Any item automatically transitions to trained without explicit approval.  

5) Approval (Admin Action)  
- In the Pending List, click "Approve" for one item.  
PASS: Status changes to approved; success notification appears; no UI crash.  
FAIL: Approval fails or breaks the interface.  

6) Learning Validation View  
- Open the Learning Validation View.  
- Select a "Before" run (pre-feedback) and an "After" run (post-approval).  
PASS: Side-by-side comparison of SQL and Assumptions is visible; No UI-calculated correctness scores.  
FAIL: No comparison available; UI attempts to "decide" if the result is correct.  

7) "No Intelligence in UI" Manual Audit (CRITICAL)  
Perform a quick code/behavioral check for these Forbidden Patterns:  
❌ Logic that parses SQL to determine validity inside the UI.  
❌ UI-side fallback queries or mock data generation.  
❌ UI-side interpretation of "Success/Failure" based on internal criteria.  
PASS: The UI is strictly a display/controller tool.  
FAIL: Any intelligence logic found in the frontend.  

8) Final Decision Matrix  
| Status | Decision |  
| --- | --- |  
| ALL Sections PASS | ✅ ACCEPT & CLOSE GATE |  
| Any FAIL in order or governance | ❌ REJECT (Frontend Reopen) |  

9) Verification Report Template  
Verifier: ____________________  
Date: ____________________  
Protocol: [ ] NDJSON  [ ] SSE  
Decision: [ ] ACCEPT  [ ] REJECT  

📊 Management/Client Dashboard Outline  
To demonstrate constitutional adherence to management, use this 5-point proof:  
1) Constitutional Order Proof: Screenshot showing technical_view rendering while data is still loading.  
2) Governance Proof: Screenshot of the pending queue showing a human-in-the-loop requirement.  
3) Audit Proof: Excerpt of audit_logs showing a feedback-to-approval-to-training lifecycle.  
4) Zero-Bias Proof: Side-by-side view of raw Backend JSON vs. UI Display to prove no interpretation.  
5) Learning Proof: Comparison view from Section 6 showing the architectural evolution of a query.  
