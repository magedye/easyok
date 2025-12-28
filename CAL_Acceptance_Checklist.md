Correctness After Learning (CAL) Acceptance Checklist  
Document Reference: Stage 2/3 Final Release Gate  
Version: 1.2-Auditable  
Purpose: To verify that EasyData v16 evolves through feedback without code modifications.  

Section 0: Mandatory Preconditions  
Must be verified before execution. Any "No" stops the test.  
[ ] Code Freeze: No backend changes since the last failed Pilot run.  
[ ] Persistence: Vector Store is in PersistentClient mode with the MAJED schema loaded.  
[ ] Governance Active: Training & Feedback endpoints are operational and audited.  
[ ] Target Selection: Failed queries (Trend/Filtering) are identified and logged.  

Section 1: Learning Cycle Activation (The Audit Trail)  
For each previously failed query, confirm the lifecycle was completed.  
[ ] Feedback Logged: /api/v1/feedback submitted with is_valid=false and specific failure reasons.  
[ ] Artifact Creation: Pending Training Item generated in the System DB.  
[ ] Governance Approval: Item approved via /api/v1/training/approve/{id}.  
[ ] Vector Sync: Audit Entry confirms the Vector Store was retrained successfully.  

Section 2: Re-Ask Validation Gates  
Re-run the exact natural language query. Analyze the NDJSON stream.  

Gate A: Structural Integrity  
[ ] Evolution: New SQL generated is distinct from the pre-learning version.  
[ ] Compliance: SQL is Oracle-compatible and free of syntax errors.  
[ ] Authenticity: Zero fallback SQL (No SELECT 1 FROM DUAL).  
Result: [ ] PASS  [ ] FAIL  

Gate B: Semantic Precision  
[ ] Intent Alignment: SQL accurately reflects the business logic (correct join keys/filters).  
[ ] Data Logic: Date ranges and categorical IDs (e.g., TRA_TYPE_ID) match the audited Oracle values.  
Result: [ ] PASS  [ ] FAIL  

Gate C: Assumption Transparency  
[ ] Visibility: assumptions array is present in the technical_view.  
[ ] Refinement: Assumptions address the specific cause of the previous failure.  
Result: [ ] PASS  [ ] FAIL  

Gate D: Outcome Quality (The Success Path)  
Choose one of the two paths below:  
[ ] Path 1: Data Success  
[ ] Real Oracle data returned (not mock).  
[ ] Chart config generated and Arabic Summary reflects actual row count.  
[ ] Path 2: Intelligent Failure  
[ ] Summary explains why data is missing and suggests query refinements.  
[ ] FAIL if response is only "No data available".  
Result: [ ] PASS  [ ] FAIL  

Section 3: Aggregate Scoring & Final Decision  
N = Total queries retrained | P = Total queries that passed all Gates (A-D).  
[ ] Success Rate (P/N): ________ %  
[ ] Safety Violations: 0 (Mandatory).  

Score | Decision | Action  
>= 80% | GO | Proceed to Stage 4 (Teams/WhatsApp).  
60% - 79% | ITERATE | One final Cognitive Recovery Round required.  
< 60% | NO-GO | Knowledge Gap is structural. Stop Pilot.  

Section 4: Explicit Exclusions (Automatic Failures)  
The following scenarios are NOT counted as successes:  
NO: Safe Failure without explanation: Blocking without business guidance.  
NO: Code-Based Improvement: Success due to manual code changes rather than RAG training.  
NO: Mock Data Return: Returning "1" or placeholders for blocked intents.  

Executive Signature: ____________________ | Date: _______________  
Final Decision: [ ] GO  [ ] NO-GO
