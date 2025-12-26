# AskResponse – NDJSON Streaming Contract (Final)

## General Rules

* **Protocol:** HTTP Streaming (NDJSON)
* **Content-Type:** `application/x-ndjson`
* **Each line:** JSON object مستقل
* **Order:** صارم (Strict Ordering)
* **No SSE, No WebSocket**
* **Stateless**

---

## Stream Order (Mandatory)

The response stream **MUST** emit chunks in the following order:

1. `technical_view`
2. `data`
3. `chart`
4. `summary`

أي انحراف في الترتيب = **خرق للعقد**.

---

## Base Envelope (All Chunks)

كل chunk يجب أن يلتزم بالهيكل التالي:

```json
{
  "type": "<chunk_type>",
  "payload": <type_specific_payload>
}
```

* `type`: string (required)
* `payload`: varies by chunk type (required)

---

## 1️⃣ `technical_view` Chunk

### Purpose

يمثل **الأثر التقني القابل للتدقيق** قبل عرض النتائج التجارية:

* SQL النهائي
* الافتراضات
* نتيجة فحص الأمان (SQL Firewall)

### Schema

```json
{
  "type": "technical_view",
  "payload": {
    "sql": "string",
    "assumptions": ["string"],
    "is_safe": true
  }
}
```

### Field Definitions

| Field         | Type          | Required | Notes                        |
| ------------- | ------------- | -------- | ---------------------------- |
| `sql`         | string        | ✅        | SQL الذي سيتم/تم تنفيذه      |
| `assumptions` | array[string] | ✅        | افتراضات تفسير السؤال        |
| `is_safe`     | boolean       | ✅        | نتيجة SQLGuard (SELECT-only) |

---

## 2️⃣ `data` Chunk

### Purpose

البيانات الخام التجارية (Business Data Only).

### Schema

```json
{
  "type": "data",
  "payload": [
    { "column1": "value", "column2": 123 }
  ]
}
```

### Rules

* `payload` **MUST be a list**
* كل عنصر يمثل صفًا
* المفاتيح = أسماء الأعمدة
* **لا SQL**
* **لا assumptions**
* **لا metadata تقنية**

---

## 3️⃣ `chart` Chunk

### Purpose

توصية الرسم البياني بناءً على شكل البيانات.

### Schema

```json
{
  "type": "chart",
  "payload": {
    "chart_type": "bar",
    "x": "column_name",
    "y": "column_name"
  }
}
```

### Allowed `chart_type`

* `bar`
* `line`
* `pie`

(قابل للتوسعة مستقبلًا دون كسر العقد)

---

## 4️⃣ `summary` Chunk

### Purpose

ملخص لغوي تجاري موجه للمستخدم.

### Schema

```json
{
  "type": "summary",
  "payload": "string"
}
```

* النص فقط
* بدون أي بيانات تقنية

---

## Error Handling (Streaming Context)

### Rule

إذا حدث خطأ **بعد بدء البث**، يجب إرسال **Error Chunk** وإنهاء البث.

### Error Chunk Schema

```json
{
  "type": "error",
  "payload": {
    "message": "string",
    "error_code": "string"
  }
}
```

### Notes

* لا يتم إرسال `summary` بعد `error`
* لا يتم تغيير HTTP status (يبقى 200)
* الخطأ جزء من الـ stream نفسه

---

## Contract Guarantees

* ✅ Backward-compatible for `data.payload` (list of rows)
* ✅ Role-aware (يمكن إخفاء `technical_view` لاحقًا)
* ✅ Testable (pytest NDJSON parsing)
* ✅ Enterprise-grade (auditability, safety, traceability)
* ✅ Compatible with Vanna Core 2.x

---

## Test Expectations (Summary)

`tests/test_ask_streaming_contract.py` يجب أن يتحقق من:

```python
assert chunks[0]["type"] == "technical_view"
assert chunks[1]["type"] == "data"
assert chunks[2]["type"] == "chart"
assert chunks[3]["type"] == "summary"
```

مع التحقق من شكل `payload` لكل chunk كما هو محدد أعلاه.

---

## Status

**✔ هذا هو AskResponse NDJSON Schema النهائي والمعتمد.**
أي تنفيذ أو اختبار يجب أن يلتزم به حرفيًا.

---
