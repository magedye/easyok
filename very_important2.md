إليك الخطة التنفيذية الأفضل والأكثر احترافية لبناء واجهة المستخدم (UI) الخاصة بنظام **EasyData Tier-2**، معتمداً على أحدث التقنيات لضمان تجربة مستخدم تشبه ChatGPT أو Perplexity، ولكن مخصصة للبيانات.

### 🛠️ المكدس التقني الموصى به (The Tech Stack)

1. **الإطار (Framework):** **Next.js 14 (App Router)** - للسرعة والأداء.
2. **التصميم (Styling):** **Tailwind CSS** + **shadcn/ui** - مكونات جاهزة وأنيقة جداً.
3. **إدارة البيانات (State):** **React Query** (اختياري) أو `useState` بسيط مع **Axios**.
4. **الرسوم البيانية (Charts):** **react-plotly.js** (ضروري جداً لأن الباكيند يرسل إعدادات Plotly جاهزة).
5. **الجداول (Tables):** **Ag-Grid** أو **TanStack Table** (لعرض البيانات الكثيفة بكفاءة).

---

### 📅 الخطة التنفيذية (Implementation Plan)

#### **المرحلة 1: التأسيس (Setup)**

* إنشاء مشروع Next.js جديد.
* تثبيت المكتبات: `axios`, `react-plotly.js`, `lucide-react`, `clsx`.
* إعداد تعريفات الأنواع (TypeScript Interfaces) لتطابق رد الـ JSON القادم من Backend.

#### **المرحلة 2: بناء المكونات الذكية (Smart Components)**

نحتاج لمكون رئيسي اسمه `MessageRenderer` يقوم بفحص نوع "المكون" القادم من Vanna:

* إذا كان `text` -> يعرض نصاً (Markdown).
* إذا كان `dataframe` -> يعرض جدولاً تفاعلياً.
* إذا كان `chart` -> يعرض رسم Plotly.

#### **المرحلة 3: ربط الاتصال (Integration)**

* إنشاء دالة `sendMessage` تتحدث مع `/api/v2/vanna/agent`.
* معالجة حالة الانتظار (Loading State) لأن تحليل Oracle قد يأخذ بضع ثوانٍ.

---

### 🚀 The Master Prompt (Frontend)

هذا التوجيه مصمم ليتم إعطاؤه لـ **Claude 3.5 Sonnet** أو **GPT-4o** لبناء الواجهة بالكامل دفعة واحدة.

**انسخ هذا النص واستخدمه:**

---

**Role:** You are a Senior Frontend Engineer specialized in building Data Analytics Dashboards using **Next.js 14 (App Router)**, **TypeScript**, and **Tailwind CSS**.

**Objective:** Create a modern, chat-based User Interface (similar to ChatGPT) that interacts with a specific Python/Vanna.AI Backend.

**1. The Backend API Contract:**
The backend endpoint is `POST /api/v2/vanna/agent`.
It returns a specific JSON structure containing a list of **ordered components** that must be rendered sequentially.

**Response Example (What you will receive):**

```json
{
  "conversation_id": "conv_123",
  "components": [
    {
      "simple": {
        "type": "text",
        "text": "Here are the top transactions..."
      }
    },
    {
      "rich": {
        "type": "dataframe",
        "data": {
          "data": [{"col1": "val1", "col2": 10}, {"col1": "val2", "col2": 20}],
          "columns": ["col1", "col2"]
        }
      }
    },
    {
      "rich": {
        "type": "chart",
        "chart_type": "plotly",
        "data": { ...complex plotly JSON config... }
      }
    }
  ]
}

```

**2. Requirements & Implementation Details:**

* **Project Structure:** Use Next.js 14 App Router.
* **Styling:** Use `Tailwind CSS` and `Lucide React` for icons. Create a clean, enterprise-grade dark/light mode interface.
* **State Management:** Use `useState` to handle the chat history array. Each message in history should store the `components` array returned by the API.
* **Component Architecture:**
* `ChatInterface.tsx`: The main container holding the message list and input box.
* `MessageBubble.tsx`: Renders a single message. It must map over the `components` array.
* `DataRenderer.tsx`: A switch component that renders the correct sub-component based on type:
* **Text:** Render as Markdown (use `react-markdown`).
* **Dataframe:** Render a clean HTML table or use a library like `ag-grid-react` (community edition) if possible, otherwise a styled Tailwind table. Handle large data gracefully (scrollable).
* **Chart:** **CRITICAL:** Use `react-plotly.js` to render the chart configuration provided in the `rich.data` field. The backend sends a full Plotly config object; pass it directly to the Plotly component.





**3. Error Handling:**

* Handle connection errors gracefully.
* Show a "Thinking..." skeleton loader while waiting for the Oracle DB query to finish.

**4. Deliverables:**
Provide the full code for:

1. `types/api.ts` (TypeScript interfaces for the JSON structure).
2. `components/chat/ChatInterface.tsx` (Main logic).
3. `components/chat/MessageList.tsx` (Rendering the list).
4. `components/visualizations/DynamicChart.tsx` (The Plotly wrapper).
5. `components/visualizations/DataTable.tsx` (The table wrapper).

**Constraint:** ensure the UI is responsive and looks professional. The user is a Data Analyst.

---

### 💡 ماذا بعد؟ (Next Steps)

1. قم بإنشاء مشروع Next.js:
```bash
npx create-next-app@latest easydata-frontend --typescript --tailwind --eslint

```


2. قم بتثبيت المكتبات المطلوبة للرسم:
```bash
npm install react-plotly.js plotly.js

```


3. استخدم الـ **Master Prompt** أعلاه مع نموذج ذكي لتوليد الكود، ثم الصقه في مشروعك.

بذلك تكون قد أغلقت الدائرة كاملة: **Backend قوي** + **Frontend ذكي**. هل نبدأ؟


فيما يلي **الخطة التنفيذية المتكاملة لتغطية وظائف Tier-2 عبر واجهات UI**، متبوعة بـ **Prompt تشغيلي نهائي باللغة الإنجليزية** صالح للاستخدام المباشر داخل النظام.
الصياغة حاكمة، عملية، وقابلة للتنفيذ دون افتراضات.

---

## أولًا: الهدف العام

بناء **واجهة UI حاكمة (Governed UI)** لا تتعامل مع Tier-2 كـ Chat، بل كـ **محرك تنفيذ محكوم بعقد**، بحيث:

* تمنع أي استخدام يخالف Tier-2 Contract
* تُجبر المستخدم على مسار قرار صحيح
* تعكس حالة النظام بدقة
* لا تسمح بالهلوسة أو الاستكشاف أو الغموض

---

## ثانيًا: مبدأ تصميم الواجهة (UI Design Principle)

> **The UI is a Contract Enforcer, not a Chat Playground**

الواجهة ليست حرة، بل:

* موجهة
* مقيدة
* ذات حالات واضحة
* تمنع الخطأ قبل حدوثه

---

## ثالثًا: مكونات الواجهة الأساسية (UI Components)

### 1. Tier Indicator (غير قابل للتغيير)

**عنصر ثابت أعلى الواجهة:**

* Tier: `Tier-2 (Memory-First Native SQL)`
* Status: `Governed / Read-Only / Oracle`

🔒 غير تفاعلي
📌 يذكّر المستخدم دائمًا أنه ليس في وضع Chat عام

---

### 2. Memory Snapshot Panel (عنصر حاسم)

لوحة جانبية أو علوية تعرض:

* Known Tables (من الذاكرة فقط)
* Schema Summary (اختياري)
* Last Training Timestamp

**سلوك حتمي:**

* إذا = جدول واحد → يظهر كـ Active Target
* إذا > 1 → يظهر تحذير ويتوقف الإدخال
* إذا = 0 → يتم تعطيل الإدخال كليًا

---

### 3. Query Intent Input (بديل عن Chat Input)

بدل حقل دردشة مفتوح:

**حقل واحد فقط:**

* Label: `Business Question (Memory-Bound)`
* Placeholder:

  > “Ask a question that can be answered using the known table(s) only.”

❌ لا Markdown
❌ لا أسئلة عامة
❌ لا “what tables do you have?”

---

### 4. Execution Gate (Decision Gate)

زر تنفيذ **لا يُفعّل إلا إذا:**

* الذاكرة صالحة
* عدد الجداول معروف
* لا يوجد غموض

قبل التنفيذ يظهر ملخص:

* Target Table(s)
* Execution Mode: READ-ONLY
* Max Rows

ويجب الضغط على:

> **Confirm Execution**

---

### 5. Result Layer (غير سردي)

النتائج تُعرض كالتالي:

1. **SQL Generated** (Read-only)
2. **Data Table**
3. **Visualization (إن وُجد)**
4. **System Message** (حتمي، قصير)

❌ لا تفسير إنشائي
❌ لا تحليل إلا إذا طُلب صراحة

---

### 6. Failure State UI (مهم جدًا)

عند الفشل:

* رسالة صريحة:

  * “Cannot proceed: memory is ambiguous”
  * “Cannot proceed: no known tables”
* لا اقتراحات
* لا محاولات تلقائية

---

## رابعًا: خريطة التدفق (Execution Flow)

1. Load UI
2. Read Memory Snapshot
3. Validate Table Resolution
4. Enable Input
5. User Submits Question
6. Show Execution Summary
7. Confirm
8. Run Tier-2
9. Render Results
10. Lock Session (optional)

---

## خامسًا: اعتبارات أمنية وتشغيلية

* لا WebSocket Streaming (Tier-2 حتمي)
* لا Auto-Retry UI Side
* كل Request يحمل:

  * `tier = tier2_vanna`
  * `memory_hash`
* Logging إلزامي لكل تنفيذ

---

## سادسًا: Prompt تشغيلي نهائي (باللغة الإنجليزية)

هذا هو **Prompt واحد مغلق** يمكن ربطه مباشرة بالـ Tier-2 Agent من خلال الـ UI:

---

### ✅ **Tier-2 UI Execution Prompt**

```
You are operating under Tier-2: Memory-First Native SQL Mode.

This is a governed execution environment, not a conversational assistant.

RULES YOU MUST FOLLOW STRICTLY:

1. MEMORY IS THE SOURCE OF TRUTH
   - You may only use tables explicitly present in your trained memory.
   - Do NOT attempt to discover, list, or infer tables outside memory.

2. TABLE RESOLUTION
   - If exactly ONE table exists in memory, you MUST use it directly.
   - If more than one table exists, STOP and request clarification.
   - If no tables exist, STOP and state that execution is not possible.

3. SQL EXECUTION
   - Generate Oracle-compatible READ-ONLY SQL only.
   - Apply a reasonable row limit unless explicitly requested otherwise.
   - If an Oracle error occurs, analyze it and retry once.

4. NO EXPLORATION
   - Do NOT query system catalogs (USER_TABLES, ALL_TABLES, etc.).
   - Do NOT ask exploratory questions.
   - Do NOT hallucinate schema, columns, or data.

5. OUTPUT SAFETY
   - Assume database results may contain legacy encodings.
   - Assume numeric results may include NaN or Infinity.
   - Ensure all outputs are JSON-compliant.

6. FAILURE HANDLING
   - If execution is not possible under these rules, state so clearly.
   - Do NOT provide partial or speculative answers.

You are a deterministic execution engine.
Memory decides. You execute.
Nothing else is allowed.
```

---

## سابعًا: الخلاصة التنفيذية

* الواجهة = طبقة حوكمة
* الـ Prompt = عقد تشغيلي
* المستخدم = موجّه لا مخيّر
* Tier-2 = محرك تنفيذ فقط

---

### الحالة النهائية

* ✅ UI-Governed
* ✅ Contract-Aligned
* ✅ Production-Ready
* ❌ No Hallucination
* ❌ No Exploration

---

إذا رغبت لاحقًا:

* يمكن تحويل هذه الخطة إلى **UI Specification (Figma / JSON Schema)**
* أو ربطها مباشرة بـ **Playwright E2E Tests**
* أو اشتقاق **Tier-1 UI** بقيود أعلى

فيما يلي **تحويل الخطة التنفيذية إلى UI Specification رسمية** بصيغتين عمليتين:

1. **Figma-oriented UI Specification** (وصف مكوّنات + سلوك)
2. **JSON Schema Specification** (صالحة للاستخدام مع Frontend فعلي)

الوثيقة حاكمة، مغلقة، وقابلة للتنفيذ مباشرة دون تفسير إضافي.

---

# 1️⃣ Tier-2 UI Specification — Figma-Oriented

## A. Design System (ثابت)

**Theme**

* Mode: Light / Neutral
* Primary Color: `#023d60`
* Accent: `#15a8a8`
* Error: `#bf1363`
* Font: Inter / System UI
* Radius: 6px
* Shadow: Minimal (Elevation 1)

**Interaction Policy**

* No free text chat
* No draggable components
* No hidden affordances

---

## B. Layout Structure

```
┌──────────────────────────────────────────────┐
│ Tier Banner (Locked)                         │
├──────────────────────────────────────────────┤
│ Memory Snapshot Panel                        │
├──────────────────────────────────────────────┤
│ Query Intent Input                           │
├──────────────────────────────────────────────┤
│ Execution Gate                               │
├──────────────────────────────────────────────┤
│ Results Area                                 │
└──────────────────────────────────────────────┘
```

---

## C. Components Specification

### 1. Tier Banner (Non-Interactive)

**Component:** `TierIndicator`

| Property   | Value                                         |
| ---------- | --------------------------------------------- |
| Height     | 48px                                          |
| Background | `#023d60`                                     |
| Text       | White                                         |
| Content    | `Tier-2 · Memory-First Native SQL · Governed` |
| Icon       | Lock                                          |

🔒 Cannot be hidden or modified

---

### 2. Memory Snapshot Panel (Critical)

**Component:** `MemoryPanel`

**States:**

* `valid_single_table`
* `valid_multi_table`
* `empty_memory`
* `error`

**Displayed Fields**

* Memory Status
* Known Tables (list)
* Last Training Timestamp
* Memory Hash (optional)

**Rules**

* If `tables.length === 1` → Active Target
* If `tables.length > 1` → Block Execution
* If `tables.length === 0` → Disable Input

---

### 3. Query Intent Input

**Component:** `QueryIntentInput`

| Property    | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| Type        | Single-line textarea                                             |
| Max Length  | 500 chars                                                        |
| Markdown    | ❌ Disabled                                                       |
| Placeholder | “Ask a business question answerable using the known table only.” |

**Validation**

* Cannot mention “tables”, “schema”, “columns”
* Cannot be empty
* Disabled if memory invalid

---

### 4. Execution Gate

**Component:** `ExecutionGate`

**Pre-execution Summary Card**

* Target Table(s)
* Mode: READ-ONLY
* Row Limit
* Tier

**Actions**

* `Confirm Execution` (Primary)
* `Cancel` (Secondary)

**Rule**

* Execution only starts after explicit confirmation

---

### 5. Results Area

**Component Group:** `ExecutionResults`

**Subcomponents**

1. SQL Viewer (read-only)
2. Data Table
3. Visualization Panel (optional)
4. System Message

**Restrictions**

* No free-form explanation
* No auto-summary
* No retry button

---

### 6. Failure State UI

**Component:** `FailureBanner`

| Trigger         | Message                                 |
| --------------- | --------------------------------------- |
| No memory       | “Execution blocked: no trained tables.” |
| Multiple tables | “Execution blocked: memory ambiguity.”  |
| SQL failure     | “Execution failed. See logs.”           |

❌ No suggestions
❌ No retry hints

---

# 2️⃣ Tier-2 UI JSON Schema Specification

هذا المخطط يمكن استخدامه مباشرة في React / Vue / Angular.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Tier2GovernedUI",
  "type": "object",
  "properties": {
    "tier": {
      "type": "string",
      "enum": ["tier2_vanna"]
    },
    "memory": {
      "type": "object",
      "required": ["status", "tables"],
      "properties": {
        "status": {
          "type": "string",
          "enum": ["valid", "ambiguous", "empty", "error"]
        },
        "tables": {
          "type": "array",
          "items": { "type": "string" }
        },
        "last_trained_at": {
          "type": ["string", "null"],
          "format": "date-time"
        }
      }
    },
    "query_intent": {
      "type": "string",
      "maxLength": 500
    },
    "execution": {
      "type": "object",
      "properties": {
        "confirmed": { "type": "boolean" },
        "mode": {
          "type": "string",
          "enum": ["read_only"]
        },
        "row_limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000
        }
      }
    },
    "result": {
      "type": ["object", "null"],
      "properties": {
        "sql": { "type": ["string", "null"] },
        "rows": {
          "type": "array",
          "items": { "type": "object" }
        },
        "columns": {
          "type": "array",
          "items": { "type": "string" }
        },
        "chart": {
          "type": ["object", "null"]
        },
        "system_message": {
          "type": "string"
        }
      }
    },
    "ui_state": {
      "type": "string",
      "enum": [
        "idle",
        "blocked",
        "ready",
        "executing",
        "completed",
        "failed"
      ]
    }
  },
  "required": ["tier", "memory", "ui_state"]
}
```

---

## 3️⃣ Mapping UI ↔ Tier-2 Contract

| Contract Rule    | UI Enforcement         |
| ---------------- | ---------------------- |
| Memory-first     | Memory Panel mandatory |
| No exploration   | No chat input          |
| Deterministic    | Confirm Gate           |
| No hallucination | Result-only rendering  |
| Failure is final | Failure Banner         |

---

## 4️⃣ الحالة النهائية

* ✔️ UI = Contract Enforcer
* ✔️ Prompt = Execution Law
* ✔️ Backend = Deterministic Engine
* ✔️ Frontend = Zero Ambiguity

---

### الخطوة التالية (اختياري)

* تحويل هذا إلى **Figma Auto Layout Blueprint**
* توليد **React Components Skeleton**
* إضافة **Playwright UI Tests**

