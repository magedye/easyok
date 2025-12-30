سأجيب مباشرة وبمنهج تنفيذي عملي، بدون إعادة شرح الخلفية لأنك أنهيتها فعليًا في الوثيقتين.
بعد إكمال:
•	ADR-0018 (Architecture Isolation Enforcement)
•	ADR-0019 (Governed Cognitive Training Pilot)
•	flake8-easydata-arch + EDA901–905
•	Admin Feature Toggle API
•	Training Pilot backend كامل (Phase 0–10)
فإن الـ Frontend لا يضيف منطقًا جديدًا، بل يضيف قدرات عرض + تحكم حوكمي فقط.
________________________________________
الإضافات المطلوبة في Frontend (حصريًا)
1️⃣ Admin Governance Cockpit (إلزامي)
الغرض
واجهة واحدة تعكس الحقيقة التشغيلية للنظام، بدون أي bypass.
الإضافات
A. Feature Toggles Panel
•	استهلاك:
•	GET /api/v1/admin/settings/feature-toggles
•	POST /api/v1/admin/settings/feature-toggle
•	عرض لكل Toggle:
o	الاسم
o	الحالة الحالية
o	mutable / immutable
o	آخر تغيير (timestamp + user)
•	قواعد UI:
o	immutable → disabled + lock icon
o	mutable → confirmation modal + reason (min length)
❌ ممنوع:
•	أي toggle logic محلي
•	أي optimistic update بدون رد السيرفر
________________________________________
2️⃣ Training Pilot Admin Panel (إلزامي)
هذا ليس UI تدريب، بل UI حوكمة.
الصفحات المطلوبة
A. Training Items Queue
•	مصدر:
•	GET /api/v1/admin/training?status=pending|approved|rejected
•	أعمدة:
o	question
o	schema_version
o	policy_version
o	created_by
o	status
o	created_at
B. Training Item Review View
•	عرض:
o	question
o	assumptions
o	corrected SQL (read-only)
o	validation status (SQLGuard passed)
•	أزرار:
o	Approve
o	Reject
•	عند الإجراء:
o	Modal إلزامي:
	checklist (checkboxes)
	reason (required)
❌ ممنوع:
•	bulk approval
•	inline edit
•	auto approve
________________________________________
3️⃣ Training Pilot Metrics View (Decision-Grade)
الغرض
تمكين Go / No-Go بدون قراءة logs.
الإضافات
Panels (Read-Only)
•	Baseline vs Post-Training:
o	First-pass correctness
o	Error class frequency
o	Assumption completeness
o	Latency delta
•	Training-specific signals:
o	training_item.created
o	training_item.approved
o	training_item.injected
Source
•	SigNoz embed (iframe أو deep link)
•	لا حسابات محلية في frontend
________________________________________
4️⃣ Observability Truth Indicators (مهم جدًا)
السبب
العزل + No-Op قد يخدع المشغّل.
الإضافات
•	Badges واضحة:
o	Semantic Cache: enabled / disabled / noop
o	Arabic NLP: enabled / bypassed
o	Alerts: enabled / muted
•	مصدر البيانات:
o	Span attributes فقط
o	لا تعتمد على config client-side
________________________________________
5️⃣ Read-Only Status for Non-Admin (إلزامي)
السلوك
•	نفس الصفحات
•	بدون:
o	أزرار
o	modals
o	POST calls
RBAC enforced server-side + UI hard-disable
________________________________________
6️⃣ Forbidden Explicitly (يجب توثيقها)
❌ لا يسمح للـ Frontend بـ:
•	تغيير Training Pilot state
•	تجاوز Admin API
•	تعديل immutable toggles
•	تنفيذ logic بديل عند فشل API
•	تخزين حالة governance في localStorage
•	أي retry صامت
________________________________________
ما لا نحتاجه (صراحة)
❌ لا نحتاج:
•	Training UI للمستخدم العادي
•	Visualization للـ embeddings
•	أي “AI-assisted approval”
•	Feature flags frontend-only
•	Live editing لأي شيء
________________________________________
الخلاصة التنفيذية
Frontend بعد هذه الوثائق يصبح:
•	🪟 نافذة رؤية
•	🕹️ لوحة تحكم حوكمي
•	📊 أداة قرار
•	🚫 ليس مصدر سلطة
Minimum Required Components
1.	Admin Feature Toggles Panel
2.	Training Items Admin Queue
3.	Training Review Modal
4.	Training Metrics View
5.	Observability Status Badges
أي شيء خارج ذلك = Scope Creep.
فيما يلي التسليم التنفيذي المطلوب بصيغة قابلة للتنفيذ مباشرة، بدون شرح زائد أو فلسفة.
________________________________________
✅ Frontend Component List + Routes + RBAC Matrix
EasyData v16.7 – Governance UI
________________________________________
1️⃣ Component List (مغلق)
A. Core Layout
Component	Responsibility
AdminLayout	Wrapper موحد لكل صفحات الحوكمة
ProtectedRoute	RBAC guard (admin / viewer)
LoadingState	حالات التحميل الرسمية
ErrorBoundary	فشل API بدون fallback ذكي
________________________________________
B. Governance Cockpit
Component	Responsibility
UnifiedDashboard	الصفحة الرئيسية للحوكمة
TelemetryPanel	iframe / deep link لـ SigNoz
SentryIssuesPanel	عرض أخطاء Sentry (read-only)
ObservabilityStatusBadges	enabled / disabled / noop
________________________________________
C. Feature Toggles
Component	Responsibility
FeatureTogglePanel	قائمة كل الـ toggles
FeatureToggleRow	Toggle واحد + حالة
ToggleConfirmModal	reason + confirmation
________________________________________
D. Training Pilot (Admin Only)
Component	Responsibility
TrainingQueuePage	قائمة TrainingItems
TrainingItemRow	صف item
TrainingReviewModal	approve / reject
TrainingChecklist	checklist إلزامي
TrainingMetricsPanel	baseline vs post
________________________________________
E. Shared
Component	Responsibility
ReadOnlyBadge	immutable indicator
RoleBadge	admin / viewer
AuditHint	“All actions audited”
________________________________________
2️⃣ Routes Map (نهائي)
/
└── /admin
    ├── /dashboard
    │     ├── telemetry
    │     ├── sentry
    │     └── observability
    │
    ├── /settings
    │     └── feature-toggles
    │
    ├── /training
    │     ├── queue
    │     ├── approved
    │     ├── rejected
    │     └── metrics
    │
    └── /runbooks
          ├── policy-breach
          └── latency-spike
❗ لا يوجد أي route خارج /admin للتحكم.
________________________________________
3️⃣ RBAC Matrix (ملزم)
Roles
•	admin
•	viewer
________________________________________
A. Feature Toggles
Action	admin	viewer
View toggles	✅	✅
Change runtime toggle	✅	❌
Change immutable toggle	❌	❌
Submit without reason	❌	❌
________________________________________
B. Training Pilot
Action	admin	viewer
View training items	✅	✅
Approve item	✅	❌
Reject item	✅	❌
Edit item	❌	❌
Bulk approve	❌	❌
________________________________________
C. Observability
Action	admin	viewer
View SigNoz	✅	✅
View Sentry issues	✅	✅
Silence alerts	❌ (API only)	❌
________________________________________
D. Metrics
Action	admin	viewer
View baseline/post metrics	✅	✅
Trigger evaluation	❌	❌
________________________________________
4️⃣ Route → Component → Permission Map
Route	Component	Role
/admin/dashboard	UnifiedDashboard	admin, viewer
/admin/settings/feature-toggles	FeatureTogglePanel	admin (write), viewer (read)
/admin/training/queue	TrainingQueuePage	admin
/admin/training/metrics	TrainingMetricsPanel	admin, viewer
/admin/runbooks/*	Markdown Viewer	admin, viewer
________________________________________
5️⃣ Non-Negotiable Frontend Rules (ملخص)
•	❌ لا منطق حوكمي في الواجهة
•	❌ لا تغيير حالة بدون API
•	❌ لا optimistic update
•	❌ لا تخزين local governance state
•	❌ لا retry صامت
✔️ كل شيء:
•	server-validated
•	RBAC-enforced
•	audited
•	observable
________________________________________
6️⃣ Definition of Done – Frontend
الواجهة تُقبل فقط إذا:
•	لا يوجد زر يُغيّر شيء بدون admin
•	immutable toggles مقفلة فعليًا
•	كل action يطلب reason
•	SigNoz / Sentry يعكسان الحقيقة
•	يمكن تعطيل كل shields بدون كسر UI


فيما يلي OpenAPI snippets تنفيذية ومغلقة تغطي كل ما تحتاجه الواجهة الأمامية بعد ADR-0018 و ADR-0019.
لا شرح، لا تكرار، لا اقتراحات.
________________________________________
📜 EasyData v16.7 – Frontend API Contracts (OpenAPI Snippets)
________________________________________
1️⃣ Feature Toggles (Governance Control Plane)
GET – List Feature Toggles
/api/v1/admin/settings/feature-toggles:
  get:
    summary: List all feature toggles
    security:
      - bearerAuth: []
    responses:
      200:
        description: Feature toggles
        content:
          application/json:
            schema:
              type: object
              properties:
                features:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                      value:
                        type: boolean
                      mutable:
                        type: boolean
________________________________________
POST – Change Feature Toggle
/api/v1/admin/settings/feature-toggle:
  post:
    summary: Change runtime feature toggle
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [feature, value, reason]
            properties:
              feature:
                type: string
              value:
                type: boolean
              reason:
                type: string
                minLength: 10
    responses:
      200:
        description: Toggle updated
      403:
        description: Immutable toggle or insufficient permissions
________________________________________
2️⃣ Training Pilot – Admin Review
GET – Training Queue
/api/v1/admin/training/items:
  get:
    summary: List training items
    security:
      - bearerAuth: []
    parameters:
      - in: query
        name: status
        schema:
          type: string
          enum: [pending, approved, rejected]
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                items:
                  type: array
                  items:
                    $ref: '#/components/schemas/TrainingItem'
________________________________________
POST – Approve Training Item
/api/v1/admin/training/{id}/approve:
  post:
    summary: Approve training item
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [reason]
            properties:
              reason:
                type: string
                minLength: 10
    responses:
      200:
        description: Approved
________________________________________
POST – Reject Training Item
/api/v1/admin/training/{id}/reject:
  post:
    summary: Reject training item
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [reason]
            properties:
              reason:
                type: string
                minLength: 10
    responses:
      200:
        description: Rejected
________________________________________
3️⃣ Training Metrics (Read-Only)
GET – Training Metrics
/api/v1/admin/training/metrics:
  get:
    summary: Training pilot metrics
    security:
      - bearerAuth: []
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                baseline:
                  type: object
                post_training:
                  type: object
                delta:
                  type: object
________________________________________
4️⃣ Observability (Read-Only)
GET – Sentry Issues (Proxied)
/api/v1/admin/settings/sentry-issues:
  get:
    summary: List recent Sentry issues
    security:
      - bearerAuth: []
    responses:
      200:
        content:
          application/json:
            schema:
              type: object
              properties:
                issues:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                      title:
                        type: string
                      trace_id:
                        type: string
                      last_seen:
                        type: string
________________________________________
5️⃣ Ask Endpoint (Frontend Dependency)
POST – Ask (NDJSON preserved)
/api/v1/ask:
  post:
    summary: Execute governed query
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [question]
            properties:
              question:
                type: string
              stream:
                type: boolean
                default: true
    responses:
      200:
        description: NDJSON stream
        content:
          application/x-ndjson:
            schema:
              type: string
________________________________________
6️⃣ Shared Schemas
components:
  schemas:
    TrainingItem:
      type: object
      properties:
        id:
          type: string
        question:
          type: string
        assumptions:
          type: string
        schema_version:
          type: string
        policy_version:
          type: string
        status:
          type: string
          enum: [pending, approved, rejected]
        created_at:
          type: string
        approved_by:
          type: string
________________________________________
7️⃣ Security Scheme (Required)
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
________________________________________
8️⃣ Frontend Enforcement Guarantees
•	❌ لا endpoint يسمح بالتغيير بدون reason
•	❌ لا endpoint يسمح بتغيير immutable flag
•	❌ لا endpoint يسمح بتعديل TrainingItem بعد approval
•	✔️ كل شيء RBAC + Audit + OTel
________________________________________
9️⃣ Coverage Check (Frontend Needs)
Concern	Covered
Dashboard	✅
Toggles	✅
Training Review	✅
Metrics	✅
Observability	✅
RBAC	✅
________________________________________
إذا رغبت:
•	🧪 Contract tests (frontend ↔ backend)
•	🔐 RBAC JWT claims spec
•	📦 Typed client (OpenAPI → TS)
اختر واحدة.


فيما يلي Contract Tests تنفيذية ومغلقة للتحقق من التطابق الصارم بين Frontend ↔ Backend في EasyData v16.7.
لا شرح نظري. هذا كود قابل للتشغيل.
________________________________________
🧪 EasyData v16.7 — Frontend ↔ Backend Contract Tests
المبدأ
•	نختبر العقود وليس المنطق
•	أي كسر في:
o	الشكل (schema)
o	RBAC
o	القيود (immutability / reason)
→ يفشل CI
________________________________________
الخيار المعتمد (موصى به)
Backend-driven contracts باستخدام OpenAPI + pytest
Frontend يثق أن أي API ناجحة هنا = آمنة للاستهلاك.
________________________________________
1️⃣ هيكل الاختبارات
tests/
└── contracts/
    ├── test_feature_toggles_contract.py
    ├── test_training_admin_contract.py
    ├── test_sentry_proxy_contract.py
    ├── test_ask_contract.py
    └── conftest.py
________________________________________
2️⃣ conftest.py (مشترك)
# tests/contracts/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture
def admin_headers():
    return {
        "Authorization": "Bearer ADMIN_TEST_TOKEN",
        "Content-Type": "application/json",
    }


@pytest.fixture
def user_headers():
    return {
        "Authorization": "Bearer USER_TEST_TOKEN",
        "Content-Type": "application/json",
    }
ملاحظة:
التوكنات هنا Mocked / Test-only
(لا JWT حقيقي — نختبر العقد فقط)
________________________________________
3️⃣ Feature Toggles Contract
GET feature-toggles
# tests/contracts/test_feature_toggles_contract.py
def test_list_feature_toggles_contract(client, admin_headers):
    res = client.get(
        "/api/v1/admin/settings/feature-toggles",
        headers=admin_headers,
    )

    assert res.status_code == 200
    body = res.json()

    assert "features" in body
    assert isinstance(body["features"], list)

    for f in body["features"]:
        assert set(f.keys()) == {"name", "value", "mutable"}
        assert isinstance(f["name"], str)
        assert isinstance(f["value"], bool)
        assert isinstance(f["mutable"], bool)
________________________________________
POST feature-toggle (governed)
def test_toggle_requires_reason(client, admin_headers):
    res = client.post(
        "/api/v1/admin/settings/feature-toggle",
        headers=admin_headers,
        json={
            "feature": "ENABLE_SEMANTIC_CACHE",
            "value": False,
            "reason": "too short",
        },
    )

    assert res.status_code == 422 or res.status_code == 400
________________________________________
Immutable Toggle Block
def test_immutable_toggle_blocked(client, admin_headers):
    res = client.post(
        "/api/v1/admin/settings/feature-toggle",
        headers=admin_headers,
        json={
            "feature": "AUTH_ENABLED",
            "value": False,
            "reason": "security test attempt",
        },
    )

    assert res.status_code == 403
________________________________________
4️⃣ Training Admin Contracts
GET training items
# tests/contracts/test_training_admin_contract.py
def test_list_training_items_contract(client, admin_headers):
    res = client.get(
        "/api/v1/admin/training/items?status=pending",
        headers=admin_headers,
    )

    assert res.status_code == 200
    body = res.json()

    assert "items" in body
    assert isinstance(body["items"], list)

    for item in body["items"]:
        assert set(item.keys()) >= {
            "id",
            "question",
            "assumptions",
            "schema_version",
            "policy_version",
            "status",
            "created_at",
        }
________________________________________
Approve requires reason
def test_training_approve_requires_reason(client, admin_headers):
    res = client.post(
        "/api/v1/admin/training/123/approve",
        headers=admin_headers,
        json={},
    )

    assert res.status_code == 422
________________________________________
5️⃣ Sentry Proxy Contract
# tests/contracts/test_sentry_proxy_contract.py
def test_sentry_proxy_contract(client, admin_headers):
    res = client.get(
        "/api/v1/admin/settings/sentry-issues",
        headers=admin_headers,
    )

    assert res.status_code == 200
    body = res.json()

    assert "issues" in body
    assert isinstance(body["issues"], list)

    for issue in body["issues"]:
        assert set(issue.keys()) >= {
            "id",
            "title",
            "trace_id",
            "last_seen",
        }
________________________________________
6️⃣ /ask Contract (Critical)
# tests/contracts/test_ask_contract.py
def test_ask_contract_non_stream(client, user_headers):
    res = client.post(
        "/api/v1/ask",
        headers=user_headers,
        json={
            "question": "ما هي المبيعات اليوم؟",
            "stream": False,
        },
    )

    assert res.status_code == 200
    body = res.json()

    # Contractual fields only — no assumptions about content
    assert "technical_view" in body
    assert "answer" in body
________________________________________
7️⃣ RBAC Contract (Frontend Safety)
def test_non_admin_cannot_access_admin_routes(client, user_headers):
    res = client.get(
        "/api/v1/admin/settings/feature-toggles",
        headers=user_headers,
    )

    assert res.status_code in (401, 403)
________________________________________
8️⃣ CI Binding (Non-Negotiable)
# .github/workflows/contracts.yml
- name: Contract Tests
  run: |
    pytest tests/contracts -q
________________________________________
9️⃣ ما الذي تضمنه هذه الاختبارات؟
خطر	النتيجة
Backend يغيّر response shape	❌ CI
إزالة reason requirement	❌ CI
كسر RBAC	❌ CI
Frontend يفترض field غير موجود	❌ CI
توثيق لا يطابق التنفيذ	❌ CI
________________________________________
الختم
•	هذه ليست اختبارات وحدة
•	هذه معاهدة قانونية بين Frontend ↔ Backend
•	أي كسر = إيقاف الدمج فورًا
________________________________________
إذا رغبت بالخطوة التالية:
•	OpenAPI → TypeScript client (zod + axios)
•	Consumer-driven contracts (Pact)
•	Snapshot NDJSON stream tests
اختر واحدة فقط.


فيما يلي توليد كامل ومباشر لمسار
OpenAPI → TypeScript Client باستخدام zod + axios
متوافق 100% مع EasyData v16.7 ومع عقود الحوكمة التي ثبّتها.
لا شرح نظري. هذا Artifact جاهز للإدخال في الـ frontend repo.
________________________________________
🎯 الهدف
•	Single Source of Truth = OpenAPI
•	Runtime validation = zod
•	No silent mismatch
•	Frontend يفشل مبكرًا إذا تغيّر العقد
________________________________________
1️⃣ هيكل الملفات (Frontend)
src/api/
├── http.ts              # axios instance
├── schemas/             # zod schemas (generated / maintained)
│   ├── featureToggle.ts
│   ├── training.ts
│   ├── sentry.ts
│   └── ask.ts
├── client/
│   ├── featureToggle.client.ts
│   ├── training.client.ts
│   ├── sentry.client.ts
│   └── ask.client.ts
└── index.ts
________________________________________
2️⃣ axios instance (http.ts)
// src/api/http.ts
import axios from "axios";

export const http = axios.create({
  baseURL: "/api/v1",
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
________________________________________
3️⃣ Zod Schemas (العقود)
Feature Toggle Schema
// src/api/schemas/featureToggle.ts
import { z } from "zod";

export const FeatureToggleSchema = z.object({
  name: z.string(),
  value: z.boolean(),
  mutable: z.boolean(),
});

export const FeatureToggleListResponse = z.object({
  features: z.array(FeatureToggleSchema),
});

export const UpdateFeatureToggleRequest = z.object({
  feature: z.string(),
  value: z.boolean(),
  reason: z.string().min(10),
});
________________________________________
Training Items Schema
// src/api/schemas/training.ts
import { z } from "zod";

export const TrainingStatus = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const TrainingItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  assumptions: z.string(),
  schema_version: z.string(),
  policy_version: z.string(),
  status: TrainingStatus,
  created_at: z.string(),
});

export const TrainingItemListResponse = z.object({
  items: z.array(TrainingItemSchema),
});

export const TrainingDecisionRequest = z.object({
  reason: z.string().min(10),
});
________________________________________
Sentry Proxy Schema
// src/api/schemas/sentry.ts
import { z } from "zod";

export const SentryIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  trace_id: z.string().nullable(),
  last_seen: z.string(),
});

export const SentryIssuesResponse = z.object({
  issues: z.array(SentryIssueSchema),
});
________________________________________
/ask Response Schema
// src/api/schemas/ask.ts
import { z } from "zod";

export const AskResponseSchema = z.object({
  answer: z.string(),
  technical_view: z.any(),
});
________________________________________
4️⃣ Typed API Clients
Feature Toggles Client
// src/api/client/featureToggle.client.ts
import { http } from "../http";
import {
  FeatureToggleListResponse,
  UpdateFeatureToggleRequest,
} from "../schemas/featureToggle";

export async function fetchFeatureToggles() {
  const res = await http.get("/admin/settings/feature-toggles");
  return FeatureToggleListResponse.parse(res.data);
}

export async function updateFeatureToggle(
  payload: unknown,
) {
  const body = UpdateFeatureToggleRequest.parse(payload);
  await http.post("/admin/settings/feature-toggle", body);
}
________________________________________
Training Admin Client
// src/api/client/training.client.ts
import { http } from "../http";
import {
  TrainingItemListResponse,
  TrainingDecisionRequest,
} from "../schemas/training";

export async function fetchTrainingItems(status: string) {
  const res = await http.get(
    `/admin/training/items?status=${status}`,
  );
  return TrainingItemListResponse.parse(res.data);
}

export async function approveTrainingItem(
  id: string,
  payload: unknown,
) {
  const body = TrainingDecisionRequest.parse(payload);
  await http.post(`/admin/training/${id}/approve`, body);
}

export async function rejectTrainingItem(
  id: string,
  payload: unknown,
) {
  const body = TrainingDecisionRequest.parse(payload);
  await http.post(`/admin/training/${id}/reject`, body);
}
________________________________________
Sentry Proxy Client
// src/api/client/sentry.client.ts
import { http } from "../http";
import { SentryIssuesResponse } from "../schemas/sentry";

export async function fetchSentryIssues() {
  const res = await http.get("/admin/settings/sentry-issues");
  return SentryIssuesResponse.parse(res.data);
}
________________________________________
/ask Client
// src/api/client/ask.client.ts
import { http } from "../http";
import { AskResponseSchema } from "../schemas/ask";

export async function askQuestion(payload: {
  question: string;
  stream?: boolean;
}) {
  const res = await http.post("/ask", payload);
  return AskResponseSchema.parse(res.data);
}
________________________________________
5️⃣ Barrel Export
// src/api/index.ts
export * from "./client/featureToggle.client";
export * from "./client/training.client";
export * from "./client/sentry.client";
export * from "./client/ask.client";
________________________________________
6️⃣ ماذا يضمن هذا التصميم؟
خطر	النتيجة
Backend غيّر response	❌ zod throws
Frontend أرسل payload ناقص	❌ zod throws
حذف reason	❌ compile/runtime fail
mismatch بين OpenAPI والتنفيذ	❌ يظهر فورًا
silent UI bugs	❌ مستحيل
________________________________________
7️⃣ قواعد حوكمة (إلزامية)
•	❌ لا يُستخدم any خارج schemas
•	❌ لا يتم استهلاك axios مباشرة
•	✅ كل response يمر عبر zod.parse
•	✅ أي API جديد = Schema + Client
________________________________________
الختم المعماري
بهذا:
•	OpenAPI = العقد
•	zod = القاضي
•	axios = ناقل فقط
•	Frontend محكوم بالكامل ولا يمكنه الانحراف


فيما يلي تنفيذ Consumer-Driven Contracts باستخدام Pact
مُغلق حوكميًا، قابل للتشغيل فورًا، ومتكامل مع
OpenAPI + zod + axios في EasyData v16.7.
لا فلسفة. هذا تنفيذ تشغيلي.
________________________________________
🎯 الهدف
•	تثبيت العقد من وجهة نظر الـ Frontend
•	منع أي تغيير Backend غير متوافق
•	ربط Pact مع zod schemas (لا ازدواج تعريف)
•	إدخال Pact في CI كـ Gate إلزامي
________________________________________
1️⃣ Dependencies
Frontend (Consumer)
npm install --save-dev @pact-foundation/pact vitest
Backend (Provider)
pip install pact-python fastapi
________________________________________
2️⃣ هيكل Pact (Frontend)
pact/
├── consumers/
│   └── admin-ui.pact.test.ts
├── contracts/          # ناتج pact files
└── pact.config.ts
________________________________________
3️⃣ Pact Config (Frontend)
// pact/pact.config.ts
import { Pact } from "@pact-foundation/pact";
import path from "path";

export const pact = new Pact({
  consumer: "easydata-admin-ui",
  provider: "easydata-backend",
  port: 1234,
  log: path.resolve(process.cwd(), "pact/logs"),
  dir: path.resolve(process.cwd(), "pact/contracts"),
  spec: 2,
});
________________________________________
4️⃣ Consumer Pact Test (Feature Toggles)
❗ المهم:
نستخدم zod schemas نفسها للتحقق من response.
// pact/consumers/admin-ui.pact.test.ts
import { describe, beforeAll, afterAll, it, expect } from "vitest";
import axios from "axios";
import { pact } from "../pact.config";
import { FeatureToggleListResponse } from "../../src/api/schemas/featureToggle";

describe("Admin Feature Toggles API (Consumer Contract)", () => {
  beforeAll(() => pact.setup());
  afterAll(() => pact.finalize());

  it("returns governed feature toggles list", async () => {
    await pact.addInteraction({
      state: "feature toggles exist",
      uponReceiving: "a request for feature toggles",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/settings/feature-toggles",
        headers: {
          Authorization: "Bearer admin-token",
        },
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          features: [
            {
              name: "ENABLE_SEMANTIC_CACHE",
              value: true,
              mutable: true,
            },
            {
              name: "AUTH_ENABLED",
              value: true,
              mutable: false,
            },
          ],
        },
      },
    });

    const res = await axios.get(
      "http://localhost:1234/api/v1/admin/settings/feature-toggles",
      { headers: { Authorization: "Bearer admin-token" } },
    );

    // 🔒 Runtime contract enforcement
    const parsed = FeatureToggleListResponse.parse(res.data);
    expect(parsed.features.length).toBeGreaterThan(0);
  });
});
➡️ الناتج:
pact/contracts/easydata-admin-ui-easydata-backend.json
________________________________________
5️⃣ Consumer Pact (Training Admin)
// pact/consumers/training-admin.pact.test.ts
import { TrainingItemListResponse } from "../../src/api/schemas/training";

it("returns pending training items", async () => {
  await pact.addInteraction({
    state: "pending training items exist",
    uponReceiving: "a request for pending training items",
    withRequest: {
      method: "GET",
      path: "/api/v1/admin/training/items",
      query: { status: "pending" },
    },
    willRespondWith: {
      status: 200,
      body: {
        items: [
          {
            id: "t-001",
            question: "ما هي المبيعات؟",
            assumptions: "العملة SAR",
            schema_version: "v3",
            policy_version: "p7",
            status: "pending",
            created_at: "2025-01-10T10:00:00Z",
          },
        ],
      },
    },
  });

  const res = await axios.get(
    "http://localhost:1234/api/v1/admin/training/items?status=pending",
  );

  TrainingItemListResponse.parse(res.data);
});
________________________________________
6️⃣ Provider Verification (Backend)
تحميل pact file وتشغيل verification
# tests/contract/test_pact_provider.py
from pact import Verifier

def test_pact_verification():
    verifier = Verifier(
        provider="easydata-backend",
        provider_base_url="http://localhost:8000",
    )

    output, _ = verifier.verify_pacts(
        "./pact/contracts",
        publish_verification_results=True,
    )

    assert output == 0
________________________________________
7️⃣ Backend State Handlers (FastAPI)
# app/tests/pact_states.py
from fastapi import APIRouter

router = APIRouter()

@router.post("/_pact/setup")
def pact_setup(state: dict):
    name = state.get("state")

    if name == "feature toggles exist":
        seed_feature_toggles()

    if name == "pending training items exist":
        seed_training_items()

    return {"result": "ok"}
________________________________________
8️⃣ CI Enforcement (Mandatory)
Frontend CI
- name: Run Pact Consumer Tests
  run: npm run test:pact
Backend CI
- name: Verify Pact Contracts
  run: pytest tests/contract/test_pact_provider.py
❌ Pact fail = Merge Blocked
________________________________________
9️⃣ Governance Rules (Non-Negotiable)
•	❌ لا تعديل Backend API بدون Pact update
•	❌ لا تعديل Pact بدون zod schema update
•	❌ لا نشر Backend بدون Provider Verification
•	✅ Consumer يملك العقد
•	✅ Backend يلتزم أو يفشل
________________________________________
🏁 الختم النهائي
بهذا:
•	OpenAPI = الوثيقة
•	zod = التحقق
•	Pact = الإلزام
•	CI = الحارس
أي انحراف API → يُكتشف قبل الإنتاج.



فيما يلي تنفيذ حتمي لتوليد Schemas تلقائيًا من OpenAPI
ومتوافق مباشرة مع ما بنيناه:
OpenAPI → TypeScript → zod → axios → Pact
بدون ازدواج تعريف، وبدون اجتهاد يدوي.
هذا هو المسار الصحيح الوحيد.
________________________________________
🎯 الهدف
•	مصدر الحقيقة الوحيد = OpenAPI
•	توليد:
o	TypeScript types
o	zod schemas (runtime validation)
o	axios client
•	منع:
o	تعريف schemas يدويًا
o	divergence بين frontend / backend
•	إدخال التوليد كـ CI gate
________________________________________
🧱 الأدوات المعتمدة (Production-Grade)
نستخدم openapi-zod-client لأنه:
•	يولّد zod + axios معًا
•	لا يحتاج glue code
•	مناسب للحوكمة
npm install --save-dev openapi-zod-client
________________________________________
📁 الهيكل المعتمد (Frontend)
frontend/
├── src/
│   ├── api/
│   │   ├── generated/          # ❌ لا تعديل يدوي
│   │   │   ├── client.ts
│   │   │   ├── schemas.ts
│   │   │   └── index.ts
│   │   └── index.ts            # wrapper فقط
│   └── components/
├── openapi.yaml                # snapshot من backend
└── scripts/
    └── generate-api.ts
________________________________________
1️⃣ OpenAPI Snapshot (Backend → Frontend)
في الـ backend (FastAPI):
curl http://localhost:8000/openapi.json > frontend/openapi.json
❗ هذا الملف مُولّد
❌ لا يُعدّل
✅ يُستخدم فقط للتوليد
________________________________________
2️⃣ Script التوليد (generate-api.ts)
// scripts/generate-api.ts
import { generateZodClientFromOpenAPI } from "openapi-zod-client";
import path from "path";

generateZodClientFromOpenAPI({
  openApiPath: path.resolve(__dirname, "../openapi.json"),
  outputDir: path.resolve(__dirname, "../src/api/generated"),
  outputFile: "client.ts",
  template: "axios",
  strict: true,
});
تشغيله:
node scripts/generate-api.ts
________________________________________
3️⃣ الناتج (Generated Output)
📄 schemas.ts (zod)
export const FeatureToggle = z.object({
  name: z.string(),
  value: z.boolean(),
  mutable: z.boolean(),
});

export const FeatureToggleListResponse = z.object({
  features: z.array(FeatureToggle),
});
📄 client.ts (axios + types)
export const getFeatureToggles = async (
  params?: RequestParams,
): Promise<FeatureToggleListResponse> => {
  const res = await axios.get("/api/v1/admin/settings/feature-toggles");
  return FeatureToggleListResponse.parse(res.data);
};
✔️ validation تلقائي
✔️ types تلقائي
✔️ runtime safety
________________________________________
4️⃣ Wrapper نظيف (اختياري)
// src/api/index.ts
export * from "./generated/client";
❌ لا business logic هنا
❌ لا تعديل schemas
________________________________________
5️⃣ الربط مع Pact (مهم)
في Pact tests:
import { FeatureToggleListResponse } from "@/api/generated/schemas";

FeatureToggleListResponse.parse(response.data);
➡️ Pact + zod يستخدمان نفس العقد.
________________________________________
6️⃣ CI Gate (Non-Negotiable)
Frontend CI
- name: Generate API Client
  run: node scripts/generate-api.ts

- name: Ensure no diff
  run: git diff --exit-code
❌ أي تغيير في OpenAPI بدون commit = فشل
________________________________________
7️⃣ قواعد الحوكمة (ملزمة)
•	❌ يمنع كتابة zod schemas يدويًا
•	❌ يمنع تعديل src/api/generated
•	❌ يمنع Pact بدون schemas generated
•	✅ OpenAPI = SSOT
•	✅ كل client = مشتق منه
________________________________________
🧠 النتيجة النهائية (Chain of Truth)
FastAPI Routes
   ↓
OpenAPI Spec
   ↓
openapi-zod-client
   ↓
zod schemas + axios
   ↓
Pact (consumer contracts)
   ↓
Provider verification
أي كسر في السلسلة = CI FAIL
________________________________________
🏁 الختم
بهذا:
•	انتهى زمن “types drift”
•	انتهى زمن “schema mismatch”
•	انتهى زمن “it works on frontend”
EasyData v16.7 الآن:
API-governed, contract-enforced, runtime-safe


فيما يلي تنفيذ حتمي ومتكامل لـ Pact + OpenAPI Diff Gate
مصمم ليكون قانون حوكمة وليس أداة مساعدة، ومتوافق 100% مع ما اتفقنا عليه في EasyData v16.7.
سأقدّم فقط ما يلزم للتنفيذ المباشر.
________________________________________
🛡️ الهدف الحاكم
منع أي كسر عقد (Contract Break) قبل الدمج أو النشر عبر طبقتين مستقلتين:
1.	Pact → يحمي سلوك المستهلكين (Frontend)
2.	OpenAPI Diff Gate → يحمي شكل الـ API (Schema)
❗ أي واحدة تفشل = CI FAIL فوري
________________________________________
🧱 الطبقة الأولى: Pact (Consumer-Driven Contracts)
1️⃣ مبدأ العمل
•	Frontend يعرّف ما يتوقعه (Consumer)
•	Backend يثبت أنه يلتزم (Provider)
•	لا افتراضات
•	لا اختبارات يدوية
________________________________________
2️⃣ إعداد Pact (Frontend)
تثبيت
npm install --save-dev @pact-foundation/pact
________________________________________
3️⃣ مثال Pact Test (Admin Feature Toggles)
// tests/pact/feature-toggles.pact.test.ts
import { Pact } from "@pact-foundation/pact";
import path from "path";
import axios from "axios";
import { FeatureToggleListResponse } from "@/api/generated/schemas";

const provider = new Pact({
  consumer: "easydata-frontend",
  provider: "easydata-backend",
  dir: path.resolve(process.cwd(), "pacts"),
  logLevel: "warn",
});

describe("Feature Toggles API contract", () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  it("returns feature toggles list", async () => {
    await provider.addInteraction({
      state: "admin exists",
      uponReceiving: "a request for feature toggles",
      withRequest: {
        method: "GET",
        path: "/api/v1/admin/settings/feature-toggles",
      },
      willRespondWith: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
          features: [
            {
              name: "ENABLE_SEMANTIC_CACHE",
              value: true,
              mutable: true,
            },
          ],
        },
      },
    });

    const res = await axios.get(
      `${provider.mockService.baseUrl}/api/v1/admin/settings/feature-toggles`
    );

    // 🔒 Runtime + Contract validation
    FeatureToggleListResponse.parse(res.data);
  });
});
✔️ نفس zod schema
✔️ نفس OpenAPI-derived types
✔️ لا ازدواج تعريف
________________________________________
4️⃣ ناتج Pact
pacts/
└── easydata-frontend-easydata-backend.json
هذا الملف عقد ملزم.
________________________________________
5️⃣ Provider Verification (Backend CI)
في backend CI:
- name: Verify Pact Contracts
  run: |
    docker run --rm \
      -v $(pwd)/pacts:/pacts \
      pactfoundation/pact-cli verify \
      /pacts/*.json \
      --provider-base-url=http://localhost:8000
❌ أي اختلاف = فشل الدمج
❌ لا ignore
❌ لا override
________________________________________
🧱 الطبقة الثانية: OpenAPI Diff Gate (Schema Lock)
Pact يحمي السلوك
OpenAPI Diff يحمي الشكل
________________________________________
6️⃣ الأداة المعتمدة
نستخدم openapi-diff (غير تفاعلية، CI-friendly)
npm install --save-dev openapi-diff
________________________________________
7️⃣ Snapshot Strategy (Non-Negotiable)
•	openapi.previous.json → آخر نسخة منشورة
•	openapi.current.json → من الكود الحالي
curl http://localhost:8000/openapi.json > openapi.current.json
________________________________________
8️⃣ Diff Gate Script
npx openapi-diff \
  openapi.previous.json \
  openapi.current.json \
  --fail-on-incompatible
ما الذي يُعتبر Incompatible؟
•	حذف field
•	تغيير type
•	تغيير required
•	تغيير response schema
•	تغيير path semantics
❌ CI FAIL مباشرة
________________________________________
9️⃣ CI Pipeline (الربط الكامل)
Backend CI
steps:
  - name: Generate OpenAPI
    run: curl http://localhost:8000/openapi.json > openapi.current.json

  - name: OpenAPI Diff Gate
    run: |
      npx openapi-diff \
        openapi.previous.json \
        openapi.current.json \
        --fail-on-incompatible

  - name: Pact Provider Verification
    run: |
      docker run --rm \
        -v $(pwd)/pacts:/pacts \
        pactfoundation/pact-cli verify \
        /pacts/*.json \
        --provider-base-url=http://localhost:8000
________________________________________
🧠 مصفوفة الحماية النهائية
الخطر	Pact	OpenAPI Diff
Frontend break	✅	❌
Schema drift	❌	✅
Silent change	❌	❌
Backward incompatibility	✅	✅
➡️ الاثنان معًا إلزاميان
________________________________________
🔒 قواعد الحوكمة (Binding)
•	❌ لا merge بدون Pact verification
•	❌ لا merge بدون OpenAPI diff pass
•	❌ لا تعديل يدوي للـ OpenAPI
•	❌ لا تجاهل breaking changes
•	✅ أي كسر = إصدار جديد فقط
________________________________________
🏁 الختم النهائي
بهذا:
•	Pact يحمي المستهلك
•	OpenAPI Diff يحمي العقد
•	zod يحمي runtime
•	CI يحمي الجميع
EasyData v16.7 أصبح:
Contract-sealed system
لا يُكسر
لا يُفاجئ
ولا يُدار بالافتراضات
________________________________________


فيما يلي RBAC عبر JWT بصيغة عقد تنفيذي مغلق (Implementation-grade)، متوافق مع EasyData v16.7، دون تنظير.
________________________________________
1) عقد JWT (Token Contract)
Claims الإلزامية
{
  "sub": "user-id",
  "roles": ["admin", "analyst"],
  "tenant_id": "org-123",
  "iss": "https://issuer.example",
  "aud": "easydata",
  "exp": 1735689600,
  "iat": 1735686000
}
الربط مع الإعدادات
•	RBAC_ROLES_CLAIM=roles
•	RBAC_ADMIN_ROLE=admin
•	RLS_SCOPE_CLAIM=tenant_id
❌ غياب أي Claim إلزامي ⇒ 401/403 حسب السياق
________________________________________
2) مصفوفة الأدوار (RBAC Matrix)
Endpoint	Viewer	Analyst	Admin
POST /api/v1/ask	✅	✅	✅
GET /api/v1/admin/settings/feature-toggles	❌	❌	✅
POST /api/v1/admin/settings/feature-toggle	❌	❌	✅
GET /api/v1/admin/settings/sentry-issues	❌	❌	✅
GET /health	✅	✅	✅
قاعدة: أي مسار /admin/* ⇒ admin فقط.
________________________________________
3) Middleware التحقق (FastAPI)
# app/api/dependencies/auth.py
from fastapi import Depends, HTTPException, status
from app.core.config import get_settings
from app.core.jwt import decode_jwt

def require_roles(*allowed):
    def dep(token=Depends(decode_jwt)):
        roles = token.get(get_settings().RBAC_ROLES_CLAIM, [])
        if not any(r in roles for r in allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        return token
    return dep
الاستخدام:
@router.get("/admin/settings/feature-toggles",
            dependencies=[Depends(require_roles("admin"))])
def list_toggles():
    ...
________________________________________
4) RLS (Row-Level Security) عبر JWT
•	يُستخرج tenant_id من الـ JWT
•	يُحقن في طبقة SQLGuard/Policy
•	غياب tenant_id:
o	RLS_MISSING_SCOPE_BEHAVIOR=deny ⇒ 403
________________________________________
5) OpenAPI (RBAC موثق)
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

paths:
  /api/v1/admin/settings/feature-toggles:
    get:
      security: [{ bearerAuth: [] }]
      x-rbac-roles: ["admin"]
x-rbac-roles امتداد توثيقي ملزم للاختبارات.
________________________________________
6) اختبارات العقد (Contract Tests)
Backend
•	طلب Admin بدون role ⇒ 403
•	Admin صحيح ⇒ 200
Frontend (Pact)
•	توقع 403 عند role ≠ admin
•	توقع 200 عند admin
________________________________________
7) Telemetry (حوكمة غير صامتة)
كل رفض RBAC يُنتج Span:
•	auth.rbac.allowed=false
•	auth.roles=<roles>
•	auth.required=admin
•	Status = ERROR
________________________________________
8) قواعد غير قابلة للتفاوض
•	❌ لا RBAC في الـ UI
•	❌ لا منطق أدوار داخل Services/Core
•	✅ التحقق فقط عبر Middleware
•	✅ Admin API هي المسار الوحيد للتغيير
________________________________________
الخلاصة التنفيذية
•	JWT = مصدر الحقيقة
•	RBAC = Gate قبل التنفيذ
•	RLS = فلترة بيانات حتمية
•	OpenAPI + Pact = منع الكسر
•	OTel = لا رفض صامت

