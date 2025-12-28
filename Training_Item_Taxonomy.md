EasyData — Training Item Taxonomy  
Governing Standard for Generalizable AI Training  

1. Executive Purpose  
The purpose of this taxonomy is to ensure that every training operation enhances the generalization of the system rather than optimizing it locally for a specific database. Training in EasyData aims to improve reasoning logic, not to memorize answers.  

2. The Governing Principle  
Any training item must improve the system's behavior across future, unknown databases.  
Reject Criteria: If a training item only benefits a single database or depends on specific table/column names, it is classified as overfitting and must be rejected.  

3. Official Training Item Classes  
🟢 Class A — Cognitive & Reasoning Training (Required)  
Description: Training items that correct or improve understanding, reasoning, assumption construction, and failure interpretation.  
Allowed Examples:  
- Temporal Logic: "When asked about trends, prioritize searching for a temporal (date/time) column first".  
- Contextual Awareness: "Absence of data does not equal a system error; explain the cause and suggest query refinements".  
- Assumption Rigor: "Explicitly state that the assumption of a date column is derived from DDL metadata".  
Evaluation: ✅ Universal | ✅ Schema-Independent | ✅ Reusable.  

🟢 Class B — Assumption Refinement Training (Allowed)  
Description: Items that improve the formulation, accuracy, and DDL-linkage of system assumptions.  
Allowed Examples:  
- "Do not assume a CREATED_AT column exists unless it is explicitly present in the DDL".  
- "In the absence of temporal metadata, declare uncertainty instead of guessing".  
Goal: Enhance transparency and minimize hallucination.  

🟢 Class C — Intelligent Failure Training (Allowed & Critical)  
Description: Items that improve system behavior when no data or no SQL can be generated.  
Allowed Examples:  
- "In 'No Data' scenarios, explain the scope and suggest broadening the filters".  
- "Never return mock or numeric placeholders to compensate for execution failure".  
Note: Intelligent failure is a cognitive success, not a system deficiency.  

🟢 Class D — Output Quality & Explanation Training (Allowed)  
Description: Improving the quality of Arabic summaries, explanations, and the link between data and meaning.  
Allowed Examples:  
- "Summaries must explain what the result implies for the business, not just repeat the numbers".  
- "Use explanatory business language rather than technical database jargon".  

🟡 Class E — Schema-Aware but Abstract Training (Conditional)  
Description: Training based on structural patterns without binding to specific names.  
Allowed Examples:  
- "Transaction tables containing temporal columns should be used for trend analysis".  
- "Tables with financial relationships often require aggregation (SUM/AVG)".  
Conditions: ❌ No specific table names | ❌ No specific column names | ✅ Structural descriptions only.  

4. Prohibited Classes (Immediate Rejection)  
🔴 Class F — Schema-Specific SQL Training (Forbidden)  
Description: Training the system on hardcoded SQL, specific tables, or specific column names.  
Forbidden Examples:  
- "Use table MAJED.TRANSACTS_T2 for this specific question".  
- "Column EXCHANGE_PRICE represents the account balance".  
Reason: This causes overfitting and turns the AI into a rigid template engine.  

🔴 Class G — Data Memorization Training (Strictly Forbidden)  
Description: Training that memorizes specific numbers, results, or static values.  
Forbidden Examples:  
- "The total balance is 643,287,927,893.28".  
- "The number of tables is 12".  
Reason: This is cache, not training.  

🔴 Class H — Behavior Patching (Forbidden)  
Description: Adding hardcoded behavioral rules instead of improving reasoning.  
Forbidden Examples:  
- "If a trend query fails, return SELECT 1".  
- "If no data is found, show nothing".  

5. Review Rules for Artifact Approval  
Before approving any training item, the Admin/Agent must verify:  
[ ] Universality: Would this training work on a completely different database?  
[ ] Cognitive Value: Does it improve understanding rather than memorization?  
[ ] Abstraction: Can it be explained without mentioning specific table names?  
[ ] Honesty: Does it prevent guessing instead of encouraging it?  
If any check fails → REJECT.  

6. Relationship to Stage 4 Gate  
Transition to Stage 4 is PROHIBITED if the vector store contains any training items from Classes F, G, or H. The presence of a single such item triggers a NO-GO decision.  
