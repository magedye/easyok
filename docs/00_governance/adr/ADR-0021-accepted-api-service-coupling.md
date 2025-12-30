# ADR-0021 — Accepted API → Service Coupling (Temporary)

**Status:** ACCEPTED (Temporary, Governed)  
**Date:** 2025-01-XX  
**Scope:** Backend Architecture / Track-A  
**Applies To:** EasyData v16.7.x

---

## 1. Context

خلال تفعيل **Track-A: Static Architectural Enforcement** باستخدام
`flake8-easydata-arch (EDA901)`، تم رصد خروقات معمارية تتمثل في:

* استيراد طبقة **API** مباشرةً من طبقة **Services**
* أمثلة:

  * `app/api/v1/admin.py → audit_service`
  * `app/api/v1/chat.py → audit_service`
  * `app/api/v1/rag_quality.py → ragas_service`
  * `app/services/orchestration_service.py → audit_service / semantic_cache_service`

هذه الخروقات **ليست جديدة**، بل موجودة منذ إصدارات سابقة، وكان النظام يعمل بها تشغيليًا.

---

## 2. Architectural Rule (Reference)

حسب التصميم المعتمد في:

* `project_design_document.md`
* `AGENTS.md`
* flake8-easydata-arch

فإن القاعدة المعمارية هي:

> API Layer must NOT import isolated Service modules directly.
> Interaction must go through orchestration / abstraction layers.

---

## 3. Reality Assessment

* هذا الاقتران المباشر تم إدخاله **عن قصد سابقًا** لدوافع:

  * Observability hooks
  * Audit logging
  * Governance visibility
* إزالة هذا الاقتران الآن تتطلب:

  * Refactor واسع
  * إعادة اختبار كاملة
  * مخاطر تشغيلية غير مقبولة في هذه المرحلة

---

## 4. Decision

📌 **يُقبل هذا الاقتران مؤقتًا كـ “Architectural Debt – Known & Governed”**

* لا يتم Refactor الآن
* لا يتم تعطيل Track-A كليًا
* يتم **توثيق الاستثناء صراحةً**
* يتم حصر الاستثناءات بدقة

---

## 5. Enforcement Action

### 5.1 flake8 Exception Scope (Temporary)

يُسمح بخرق `EDA901` **فقط** في الملفات التالية:

```text
app/api/v1/admin.py
app/api/v1/admin/sandbox.py
app/api/v1/admin/settings.py
app/api/v1/admin/training.py
app/api/v1/assets.py
app/api/v1/chat.py
app/api/v1/query.py
app/api/v1/rag_quality.py
app/api/v1/schema.py
app/api/v1/training.py
app/services/orchestration_service.py
```

أي ملف جديد خارج هذه القائمة:
❌ **غير مسموح له بالاقتران المباشر**

---

## 6. Guardrails (Non-Negotiable)

* ❌ لا يُسمح بإضافة API→Service imports جديدة
* ❌ لا يُسمح بتوسيع القائمة دون ADR جديد
* ✅ أي refactor مستقبلي يجب أن:

  * يزيل هذا الاقتران
  * يعيد تفعيل EDA901 بالكامل

---

## 7. Exit Criteria (How this ADR is retired)

يُلغى هذا ADR فقط عند:

* تنفيذ Refactor معماري كامل
* تمرير Track-A بدون أي استثناء
* اعتماد ADR بديل يثبت الإصلاح

---

## 8. Consequences

**Positive**

* النظام يعمل
* الحوكمة صادقة
* Track-A يبقى مفعّلًا جزئيًا

**Negative**

* وجود دين معماري معروف
* زيادة مسؤولية المراجعة المستقبلية

---

## 9. Final Statement

> This ADR prefers **architectural honesty** over theoretical purity.
> The system remains governed, not pretending to be compliant.

---

## الخطوة التنفيذية التالية (محددة)

1. إضافة هذا الـ ADR إلى:

   ```
   docs/adr/ADR-0021-accepted-api-service-coupling.md
   ```
2. تحديث إعداد flake8 (أو checker) لاستثناء الملفات المذكورة **فقط**
3. إعادة تشغيل `./start.sh` والتحقق من Track-A
