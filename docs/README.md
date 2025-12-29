# EasyData Documentation Map (Phase 1)

> Warning: Editing documentation content requires ADR approval.

## Directory guide
- **Binding** `00_governance/` – ADR registry, contracts (bridge contract, security matrix, semantic cache schema), audits; `golden_logic/` reserved for future governed logic.
- **Binding** `01_architecture/` – project design document, system definitions, and workflow diagrams.
- **Binding** `02_requirements/` – requirements set including SRS and project requirements snapshot.
- **Reference** `03_operations/` – runbooks, observability span contracts, and deployment setup notes.
- **Binding** `04_training/` – governed training pilot materials, DDL training guide, and issue reports.
- **Reference** `05_frontend/` – governance UI integration artifacts and delivery summaries (read-only samples).
- **Archived/Reference** `90_reference/` – legacy or external assets retained for traceability.

## Where to start
- **Developers:** `01_architecture/project_design_document.md`, `02_requirements/software_requirements_spec.md`.
- **Operators:** `03_operations/runbooks/latency_spike.md`, `03_operations/observability/signoz.md`.
- **Auditors:** `00_governance/adr_arch_dec_record.md`, `00_governance/contracts/security_permissions_matrix.md`, `00_governance/contracts/bridge_contract_v16_7_8.md`.

## Move log (Phase 1)
| Old path | New path |
| --- | --- |
| `docs/adr` | `docs/00_governance/adr` |
| `docs/adr_arch_dec_record.md` | `docs/00_governance/adr_arch_dec_record.md` |
| `docs/bridge_contract_v16_7_8.md` | `docs/00_governance/contracts/bridge_contract_v16_7_8.md` |
| `docs/security_permissions_matrix.md` | `docs/00_governance/contracts/security_permissions_matrix.md` |
| `docs/semantic_cache_schema.md` | `docs/00_governance/contracts/semantic_cache_schema.md` |
| `docs/ready_code/EASYDATA_V16_COMPLETE_ARCHITECTURE.md` | `docs/00_governance/audits/EASYDATA_V16_COMPLETE_ARCHITECTURE.md` |
| `docs/ready_code/ARCHITECTURAL_AUDIT.md` | `docs/00_governance/audits/ARCHITECTURAL_AUDIT.md` |
| `docs/ready_code/GOLDEN_LOGIC_AUDIT.md` | `docs/00_governance/audits/GOLDEN_LOGIC_AUDIT.md` |
| `docs/ready_code/ARCHITECTURAL_AUDIT_GOLDEN_LOGIC.md` | `docs/00_governance/audits/ARCHITECTURAL_AUDIT_GOLDEN_LOGIC.md` |
| `docs/project_design_document.md` | `docs/01_architecture/project_design_document.md` |
| `docs/data_model_schema_context.md` | `docs/01_architecture/system_definition/data_model_schema_context.md` |
| `docs/Vanna 2.0 System Definition Document.md` | `docs/01_architecture/system_definition/Vanna 2.0 System Definition Document.md` |
| `docs/deepseek_Complete Workflow.mermaid` | `docs/01_architecture/workflows/deepseek_Complete Workflow.mermaid` |
| `docs/deepseek_Complete Workflow.svg` | `docs/01_architecture/workflows/deepseek_Complete Workflow.svg` |
| `docs/software_requirements_spec.md` | `docs/02_requirements/software_requirements_spec.md` |
| `docs/Project Requirements & Specifications Document.md` | `docs/02_requirements/project_requirements.md` |
| `docs/runbooks/latency_spike.md` | `docs/03_operations/runbooks/latency_spike.md` |
| `docs/runbooks/policy_breach.md` | `docs/03_operations/runbooks/policy_breach.md` |
| `docs/quickstarts/ddl_extraction.md` | `docs/03_operations/runbooks/ddl_extraction.md` |
| `docs/observability/signoz.md` | `docs/03_operations/observability/signoz.md` |
| `docs/observability/sentry_signoz_correlation.md` | `docs/03_operations/observability/sentry_signoz_correlation.md` |
| `docs/semantic_cache_spans.md` | `docs/03_operations/observability/semantic_cache_spans.md` |
| `docs/development_setup.md` | `docs/03_operations/deployment/development_setup.md` |
| `docs/training_pilot.md` | `docs/04_training/pilots/training_pilot.md` |
| `docs/issue_reports/schema-aware-training-failure.md` | `docs/04_training/issues/schema-aware-training-failure.md` |
| `docs/refrence/training-guide.md` | `docs/04_training/pilots/training-guide.md` |
| `docs/reports/oracle_training_scripts.csv` | `docs/90_reference/legacy_or_external/oracle_training_scripts.csv` |
| `docs/ready_code_frontend/EASYDATA_FRONTEND_INDEX.md` | `docs/05_frontend/integration/EASYDATA_FRONTEND_INDEX.md` |
| `docs/ready_code_frontend/EASYDATA_STREAMING_INTEGRATION.md` | `docs/05_frontend/integration/EASYDATA_STREAMING_INTEGRATION.md` |
| `docs/ready_code_frontend/EASYDATA_STREAMING_ARCHITECTURE.md` | `docs/05_frontend/integration/EASYDATA_STREAMING_ARCHITECTURE.md` |
| `docs/ready_code_frontend/EASYDATA_INTEGRATION_CHECKLIST.md` | `docs/05_frontend/integration/EASYDATA_INTEGRATION_CHECKLIST.md` |
| `docs/ready_code_frontend/EASYDATA_BACKEND_INTEGRATION_EXAMPLE.md` | `docs/05_frontend/integration/EASYDATA_BACKEND_INTEGRATION_EXAMPLE.md` |
| `docs/ready_code_frontend/easydata_refactored_code_hook.ts` | `docs/05_frontend/integration/easydata_refactored_code_hook.ts` |
| `docs/ready_code_frontend/easydata_refactored_code_utils.ts` | `docs/05_frontend/integration/easydata_refactored_code_utils.ts` |
| `docs/ready_code_frontend/easydata_refactored_code_components.tsx` | `docs/05_frontend/integration/easydata_refactored_code_components.tsx` |
| `docs/ready_code_frontend/easydata_refactored_code_types.ts` | `docs/05_frontend/integration/easydata_refactored_code_types.ts` |
| `docs/ready_code_frontend/EASYDATA_README.md` | `docs/05_frontend/integration/EASYDATA_README.md` |
| `docs/ready_code_frontend/EASYDATA_SUMMARY.md` | `docs/05_frontend/delivery/EASYDATA_SUMMARY.md` |
| `docs/ready_code_frontend/DELIVERY_SUMMARY.txt` | `docs/05_frontend/delivery/DELIVERY_SUMMARY.txt` |
