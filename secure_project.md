فيما يلي **الخطة التنفيذية الشاملة والنهائية** لتحويل مشروع **EasyData Fortress / easyok** من حالة *Stable Backend + Partial Frontend* إلى **نظام إنتاجي كامل (Production-Ready Full-Stack System)**.
الخطة مصاغة كوثيقة تنفيذ ملزمة، بدون تنظير، ومبنية حصريًا على:

* البنية الحالية للمستودع
* المقترحات التي قدمتها كاملة
* ما تم اعتماده فعليًا (SQLite + ChromaDB، NDJSON، Governance Lock)

---

# 🛡️ EasyData Fortress

## Executive Full Execution Plan — Production Readiness

**الحالة:** FINAL – Execution Only
**لا يوجد Refactor معماري**
**لا يوجد تغيير قرارات**
**المطلوب: تفعيل، ربط، إغلاق تشغيلي**

---

## 0. المبادئ الحاكمة (غير قابلة للنقاش)

1. **SQLite = System of Record**
2. **ChromaDB = Semantic Memory فقط**
3. **كل شيء قابل للتدقيق → SQLite**
4. **كل ذكاء = Backend فقط**
5. **Frontend = Governed Client**
6. **No Bypass في production**
7. **أي كسر عقد = فشل تشغيل**

---

## 1. Phase A — Authentication (JWT) ✅ إلزامي

### الهدف

إلغاء Bypass Mode نهائيًا، وتفعيل هوية موحدة قابلة للتدقيق.

### التنفيذ

#### 1.1 متغيرات البيئة (إلزامي)

```bash
AUTH_ENABLED=true
JWT_SECRET_KEY=<vault>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_MINUTES=1440
AUTH_TOKEN_ISSUER=easydata-auth
AUTH_TOKEN_AUDIENCE=easydata-api
```

#### 1.2 Backend

* تفعيل:

  * `app/security/jwt.py`
  * `app/security/dependencies.py`
  * `app/api/auth.py`
* رفض الإقلاع إذا:

  * AUTH_ENABLED=true بدون JWT_SECRET_KEY
* كل endpoint محمي → JWT أو 401

#### 1.3 Bootstrap

* تنفيذ `initialize_fortress.py`
* إنشاء:

  * admin user
  * roles
  * policy
  * feature toggles

### DoD

* login يعمل
* token منتهي → 401
* payload يحتوي `sub`, `roles`, `trace_id`

---

## 2. Phase B — Authorization (RBAC) ✅ إلزامي

### الهدف

منع أي وصول غير مصرح به على مستوى الوظيفة.

### التنفيذ

#### 2.1 متغيرات

```bash
RBAC_ENABLED=true
RBAC_STRICT_MODE=true
```

#### 2.2 Backend

* جميع endpoints الإدارية:

```python
Depends(require_permission("admin:*"))
```

* لا منطق صلاحيات في Frontend
* كل رفض → 403 + Audit Log

### DoD

* RBAC_ENABLED=false → تجاهل
* RBAC_ENABLED=true → أي نقص تصريح = 403

---

## 3. Phase C — Row-Level Security (RLS) ⛔ اختياري

### الحالة

```bash
RLS_ENABLED=false
```

### القاعدة

* لا يُفعّل بدون ADR
* عند التفعيل:

  * SchemaAccessPolicy إلزامي
  * غياب السياسة = 403
  * لا نتائج فارغة صامتة

### القرار

❌ لا يُفعّل في Go-Live الأول

---

## 4. Phase D — Storage Architecture (Final)

### 4.1 SQLite (System of Record)

يخزن إلزاميًا:

| المجال                   | سبب          |
| ------------------------ | ------------ |
| users / roles / tokens   | هوية + تدقيق |
| training_items           | حوكمة        |
| policy_versions          | أثر قانوني   |
| query_logs + assumptions | traceability |
| feedback                 | دورة التعلم  |
| audit_logs               | امتثال       |

> SQLite الآن، Postgres لاحقًا بدون كسر كود

---

### 4.2 ChromaDB (Semantic Only)

يخزن فقط:

* embeddings
* similarity metadata
* item_id references

❌ لا حسابات
❌ لا سياسات
❌ لا قرارات

عند التعارض → SQLite يحكم

---

## 5. Phase E — Frontend Hardening (Governed Client)

### 5.1 Startup Discovery

عند الإقلاع:

```text
GET /health/llm
GET /admin/settings/feature-toggles
```

يُخزن في `GovernanceContext`:

* AUTH_ENABLED
* RBAC_ENABLED
* ENABLE_TRAINING_PILOT

### 5.2 Gatekeeping

* AUTH_ENABLED=true → أي Route بدون Token → /login
* token في `sessionStorage` فقط

### 5.3 API Client

* Inject:

  * Authorization: Bearer
  * X-Request-ID (UUID)
* Interceptors:

  * 401 → clear token + redirect
  * 429 → exponential backoff

---

## 6. Phase F — NDJSON Fortress (Streaming Integrity)

### التنفيذ

* Stream State Machine صارم:

```text
thinking → technical_view → data → end
```

### القواعد

* trace_id ثابت
* أي خرق → إلغاء العرض
* SQL يظهر read-only فقط

### DoD

* أي Chunk خارج الترتيب → رفض
* أي trace mismatch → reject stream

---

## 7. Phase G — Observability & Audit ✅ إلزامي

### متغيرات

```bash
ENABLE_AUDIT_LOGGING=true
ENABLE_OTEL=true
OTEL_SERVICE_NAME=easydata-backend
OTEL_EXPORTER_OTLP_ENDPOINT=<collector>
OTEL_SAMPLER_RATIO=0.1
```

### الضمانات

* كل request → trace_id
* كل violation → audit_logs
* frontend ↔ backend correlation فعال

---

## 8. Phase H — CI / Runtime Enforcement

### CI Must Fail If

* AUTH_ENABLED=true مع نقص JWT vars
* RBAC_ENABLED=true بدون حماية endpoints
* OpenAPI mismatch
* skipped governance tests

### Runtime Must Refuse Start If

* audit disabled
* training enabled without readiness
* bypass flags موجودة

---

## 9. Final Definition of Done (Go-Live)

✔ JWT + RBAC مفعّلين
✔ Admin bootstrap تم
✔ Frontend gated
✔ NDJSON validated
✔ Audit searchable by trace_id
✔ DROP TABLE → 403 + log
✔ CI green
✔ Release tagged

---

## الحكم النهائي

* المشروع **جاهز معماريًا 100%**
* ما نُفذ حتى الآن = صحيح
* لا إعادة بناء
* لا قرارات جديدة
* فقط **تنفيذ منضبط**

---

فيما يلي **Checklist تشغيل يوم الإطلاق (Go-Live Runbook)** لنظام **EasyData Fortress**.
هذه وثيقة تشغيلية حازمة، تُنفّذ حرفيًا، وأي فشل في بند واحد = **إيقاف الإطلاق فورًا**.

---

# 🛡️ EasyData Fortress

## Go-Live Runbook — Day-Zero Production Launch

**الغرض:** ضمان إطلاق إنتاجي آمن، قابل للتدقيق، بلا سلوك غير متوقع
**النطاق:** Backend + Frontend + Security + Data + CI
**المسؤول:** فريق Backend / Security / DevOps
**القاعدة:** لا يوجد “نصلحه بعد الإطلاق”

---

## 0. قرار البدء (Go / No-Go)

☐ تم اعتماد هذه الوثيقة رسميًا
☐ لا توجد تغييرات كود معلّقة
☐ لا توجد ADRs مفتوحة
☐ تم تجميد المستودع (Code Freeze)

❌ في حال وجود أي بند غير مكتمل → **NO-GO**

---

## 1. فحص البيئة (Environment Sanity Check)

### 1.1 متغيرات البيئة الحرجة

```bash
ENV=production
APP_ENV=production

AUTH_ENABLED=true
RBAC_ENABLED=true
ADMIN_LOCAL_BYPASS=false

ENABLE_AUDIT_LOGGING=true
ENABLE_TRAINING_PILOT=true
TRAINING_READINESS_ENFORCED=true
```

☐ لا يوجد أي bypass flag مفعّل
☐ لا توجد قيم افتراضية في production

---

### 1.2 الأسرار (Secrets)

☐ JWT_SECRET_KEY محقون من Vault / CI
☐ ORACLE_CONNECTION_STRING غير موجود في Git
☐ ADMIN_INITIAL_PASSWORD غير مسجل في أي log
☐ لا يوجد Secret داخل `.env.production`

❌ أي Secret مكشوف = **إيقاف الإطلاق**

---

## 2. قاعدة البيانات (System of Record)

### 2.1 الاتصال

☐ الاتصال بقاعدة البيانات الإنتاجية ناجح
☐ SSL مفعّل (إن وُجد)
☐ المستخدم محدود الصلاحيات

### 2.2 التهيئة

☐ تم تشغيل `initialize_fortress.py` بنجاح
☐ المستخدم الإداري موجود
☐ الأدوار موجودة (admin / analyst / viewer)
☐ SchemaAccessPolicy نشطة
☐ PolicyVersion فعّالة
☐ FeatureToggles متوافقة مع `.env`

---

## 3. المصادقة (Authentication)

### اختبارات إلزامية

☐ `POST /api/v1/auth/login` يعمل
☐ access_token يُعاد بشكل صحيح
☐ refresh_token يُعاد
☐ token payload يحتوي:

* sub
* roles
* trace_id

### اختبارات فشل

☐ توكن منتهي → 401
☐ توقيع غير صحيح → 401

❌ أي تجاوز = **NO-GO**

---

## 4. التفويض (RBAC)

### اختبارات إلزامية

☐ مستخدم viewer لا يصل لنقاط admin
☐ analyst لا يوافق تدريب
☐ admin فقط يغيّر Feature Toggles

### تحقق أمني

☐ كل رفض = 403
☐ كل رفض مسجّل في audit_logs مع trace_id

---

## 5. Frontend (Governed Client)

### 5.1 الإقلاع

☐ Frontend يستدعي:

* `/health/llm`
* `/admin/settings/feature-toggles`

☐ GovernanceContext مفعّل
☐ AUTH_ENABLED=true → redirect غير المصرّح إلى /login

### 5.2 التوكن

☐ التوكن محفوظ في sessionStorage فقط
☐ لا يوجد localStorage tokens

### 5.3 API Client

☐ Authorization Header يُحقن تلقائيًا
☐ X-Request-ID موجود في كل طلب
☐ 401 → logout فوري
☐ 429 → backoff يعمل

---

## 6. NDJSON Streaming (Fortress Contract)

### اختبارات إلزامية

☐ الترتيب:

```text
thinking → technical_view → data → end
```

☐ trace_id ثابت في جميع الـ chunks
☐ أي chunk مخالف → stream يُلغى
☐ SQL يظهر read-only فقط

---

## 7. SQL Guard & Security

### اختبار اختراق

☐ إدخال:

```sql
DROP TABLE users;
```

☐ النتيجة:

* 403 Forbidden
* Audit log مسجّل
* trace_id موجود

❌ أي تنفيذ فعلي = **إيقاف فوري**

---

## 8. Audit & Observability

### التحقق

☐ ENABLE_AUDIT_LOGGING=true
☐ كل طلب يولّد trace_id
☐ يمكن البحث عن trace_id في audit_logs
☐ correlation frontend ↔ backend يعمل

### Telemetry

☐ OTEL exporter متصل
☐ لا بيانات حساسة في traces

---

## 9. CI / CD Final Gate

☐ جميع اختبارات pytest تمر مع AUTH_ENABLED=true
☐ لا skipped governance tests
☐ OpenAPI contract مطابق
☐ Playwright E2E ناجح

❌ أي فشل = **NO-GO**

---

## 10. قرار الإطلاق النهائي

### إذا جميع البنود ✔

✅ **GO-LIVE APPROVED**

### بعد الإطلاق مباشرة

☐ Tag الإصدار (vX.Y.Z)
☐ أرشفة artifacts
☐ تفعيل المراقبة
☐ إغلاق ADMIN_INITIAL_PASSWORD (invalidate)

---

فيما يلي **Runbook الطوارئ (Rollback & Incident Response)** لنظام **EasyData Fortress**.
هذه وثيقة تشغيلية ملزمة، تُستخدم فقط عند وقوع حادث فعلي، وتُنفّذ بدون اجتهاد أو تعديل أثناء الحادث.

---

# 🚨 EasyData Fortress

## Emergency Runbook — Rollback & Incident Response

**النطاق:** Production Only
**الأولوية:** حماية البيانات > إيقاف النزيف > الاسترجاع > التحقيق
**مبدأ التشغيل:** *Stabilize First, Diagnose Later*

---

## 0. تصنيف الحوادث (Incident Classification)

| المستوى | الوصف                                      | الإجراء       |
| ------- | ------------------------------------------ | ------------- |
| P0      | اختراق أمني / تسريب بيانات / تنفيذ SQL ضار | إيقاف فوري    |
| P1      | انهيار خدمة أساسية / مصادقة                | Rollback      |
| P2      | سلوك غير متوقع بدون تسريب                  | تقييد + تحقيق |
| P3      | خلل واجهة / أداء                           | مراقبة        |

---

## 1. إجراءات فورية (First 5 Minutes)

### 1.1 تثبيت النظام (Stabilization)

☐ إيقاف أي نشر تلقائي
☐ تجميد CI/CD
☐ منع أي تغييرات يدوية على الإنتاج

---

### 1.2 احتواء الضرر (Containment)

#### في حال شبهة اختراق:

```bash
AUTH_ENABLED=true
RBAC_ENABLED=true
ENABLE_TRAINING_PILOT=false
```

☐ تعطيل التدريب فورًا
☐ تعطيل أي endpoints غير أساسية
☐ تدوير JWT_SECRET_KEY فورًا

---

## 2. Rollback فوري (If Required)

### 2.1 شروط الـ Rollback الإلزامي

* P0 أو P1
* تنفيذ SQL غير مصرح
* فشل Auth / RBAC عام

---

### 2.2 خطوات الـ Rollback

1. تحديد آخر Tag مستقر:

```bash
git tag --list
```

2. النشر من الـ Artifact السابق (بدون build جديد)

3. إعادة تشغيل الخدمات:

```bash
systemctl restart easydata-backend
```

☐ لا تغيير في قاعدة البيانات
☐ لا حذف سجلات

---

## 3. التحقق بعد Rollback

☐ النظام يقلع بدون bypass
☐ المصادقة تعمل
☐ الاستعلامات محمية
☐ NDJSON سليم
☐ Audit logging فعّال

❌ إذا فشل بند واحد → **إيقاف الخدمة بالكامل**

---

## 4. حوادث أمنية (Security Incidents)

### 4.1 اشتباه تسريب توكن

☐ تدوير JWT_SECRET_KEY
☐ إبطال جميع refresh tokens
☐ فرض إعادة تسجيل دخول

---

### 4.2 تنفيذ SQL ضار

☐ عزل المستخدم
☐ حفظ كل audit_logs
☐ تعطيل الحساب مؤقتًا
☐ تصدير logs للتحقيق

---

## 5. قاعدة البيانات (Data Protection)

### 5.1 قبل أي إصلاح

☐ أخذ snapshot فوري للقاعدة
☐ عدم تعديل أي سجل

---

### 5.2 الاسترجاع (إذا لزم)

* استرجاع من snapshot
* إعادة تشغيل الخدمة
* مقارنة audit_logs قبل/بعد

---

## 6. Frontend Incident Handling

### 6.1 تعطيل الوصول مؤقتًا

* إرجاع:

```http
503 Service Unavailable
```

☐ لا تعطيل backend بدون سبب أمني
☐ لا عرض رسائل تقنية للمستخدم

---

## 7. التحقيق بعد الحادث (Post-Incident)

### 7.1 جمع الأدلة

☐ trace_id للحادث
☐ user_id
☐ role
☐ endpoint
☐ SQL hash

---

### 7.2 التقرير الإلزامي (Within 24h)

يجب أن يتضمن:

* Timeline
* Root Cause
* Impact
* Fix
* Prevention

---

## 8. قواعد ممنوعة أثناء الحادث

❌ لا Hotfix مباشر على production
❌ لا تعديل يدوي للبيانات
❌ لا تعطيل Audit
❌ لا تفعيل bypass لأي سبب

---

## 9. قرار إعادة الفتح (Re-Enable)

يُسمح بإعادة التشغيل فقط إذا:

☐ السبب الجذري محدد
☐ الحل موثق
☐ ADR جديد (إن لزم)
☐ Runbook محدث

---

## البيان الختامي

EasyData Fortress **يُطفأ ولا يُخترق**
ويُجمَّد ولا يُصلح تحت النار.

---

#فيما يلي **Chaos / Failure Injection Plan** لاختبار جاهزية **EasyData Fortress**.
هذه خطة اختبار عدائي منضبط، تُنفَّذ **قبل الإنتاج أو في بيئة Staging مطابقة**، وتهدف لكشف نقاط الفشل الخفية قبل أن يفعلها الواقع.

---

# 💥 EasyData Fortress

## Chaos & Failure Injection Readiness Plan

**الهدف:** إثبات أن النظام لا يفشل بصمت، ولا يتجاوز الحوكمة تحت الضغط
**النطاق:** Backend / Frontend / Auth / Storage / Streaming
**المبدأ:** *Fail Closed, Not Open*

---

## 0. قواعد التنفيذ (غير قابلة للكسر)

* التنفيذ فقط في **Staging مطابق للإنتاج**
* Audit logging **مفعل دائمًا**
* لا تعطيل RBAC أو AUTH أثناء الاختبار
* كل تجربة لها:

  * Start time
  * trace_id
  * Expected behavior
  * Actual behavior
* أي سلوك غير موثق = **فشل جاهزية**

---

## 1. سيناريوهات المصادقة (Authentication Chaos)

### 1.1 توكن منتهي

**الحقن:** إرسال access_token منتهي الصلاحية
**المتوقع:**

* Backend → 401
* Frontend → logout + redirect
* Audit log → token_expired

---

### 1.2 توكن بتوقيع خاطئ

**الحقن:** تعديل بايت واحد في JWT
**المتوقع:**

* 401
* لا معالجة صامتة
* trace_id محفوظ

---

### 1.3 غياب توكن

**الحقن:** حذف Authorization header
**المتوقع:** 401 فوري

---

## 2. سيناريوهات التفويض (RBAC Chaos)

### 2.1 تجاوز صلاحية

**الحقن:** مستخدم viewer يستدعي admin endpoint
**المتوقع:**

* 403
* Audit log يحتوي:

  * user_id
  * role
  * permission_missing

---

### 2.2 Endpoint غير محمي (اختبار كشف)

**الحقن:** فحص جميع endpoints عبر OpenAPI
**المتوقع:**

* RBAC_STRICT_MODE → فشل الإقلاع أو 403

---

## 3. Streaming Chaos (NDJSON Fortress)

### 3.1 كسر الترتيب

**الحقن:** إرسال `data` قبل `technical_view`
**المتوقع:**

* Frontend يرفض stream
* رسالة حوكمة واضحة
* Audit event: stream_order_violation

---

### 3.2 trace_id متغير

**الحقن:** تغيير trace_id في chunk ثاني
**المتوقع:**

* إلغاء الجلسة
* لا عرض بيانات

---

## 4. SQL Guard Chaos

### 4.1 SQL مدمر

**الحقن:**

```sql
DROP TABLE audit_logs;
```

**المتوقع:**

* 403
* لا تنفيذ
* audit_log: sql_guard_violation

---

### 4.2 SQL جانبي

**الحقن:**

```sql
SELECT * FROM users WHERE 1=1;
```

**المتوقع:**

* رفض حسب SchemaAccessPolicy
* 403

---

## 5. Database Failure Chaos

### 5.1 انقطاع قاعدة البيانات

**الحقن:** إيقاف اتصال Postgres مؤقتًا
**المتوقع:**

* Circuit Breaker يفتح
* استجابة موحدة
* لا crash

---

### 5.2 تأخير شديد

**الحقن:** latency 10s
**المتوقع:**

* Timeout مضبوط
* عدم تعليق frontend

---

## 6. Secrets & Config Chaos

### 6.1 حذف JWT_SECRET_KEY

**الحقن:** إزالة المتغير من البيئة
**المتوقع:**

* التطبيق يرفض الإقلاع
* log واضح

---

### 6.2 تبديل Feature Toggle

**الحقن:** تعطيل ENABLE_TRAINING_PILOT أثناء التشغيل
**المتوقع:**

* التدريب يتوقف فورًا
* لا restart

---

## 7. Frontend Chaos

### 7.1 429 Rate Limit

**الحقن:** ضغط requests
**المتوقع:**

* Exponential backoff
* لا spam

---

### 7.2 فقد الاتصال أثناء stream

**الحقن:** قطع الشبكة
**المتوقع:**

* UI يوقف العرض
* رسالة واضحة
* لا حالة معلقة

---

## 8. Audit Integrity Chaos

### 8.1 تعطيل Audit Logging (اختبار حارس الإقلاع)

**الحقن:** ENABLE_AUDIT_LOGGING=false
**المتوقع:**

* التطبيق يرفض الإقلاع

---

### 8.2 تلف سجل

**الحقن:** إدخال سجل audit ناقص
**المتوقع:**

* رفض الإدخال
* عدم إسقاط النظام

---

## 9. CI / Governance Chaos

### 9.1 تجاوز CI

**الحقن:** محاولة نشر بدون اختبارات
**المتوقع:** CI يفشل

---

### 9.2 كسر العقد

**الحقن:** تغيير OpenAPI بدون تحديث Frontend
**المتوقع:** E2E يفشل

---

## 10. تقرير الجاهزية (Mandatory Output)

لكل سيناريو:

* Scenario ID
* Injected Fault
* Expected Behavior
* Actual Behavior
* PASS / FAIL
* trace_id
* Fix Required (Yes/No)

❌ أي FAIL غير معالج = **النظام غير جاهز للإنتاج**

---

## البيان الختامي

EasyData Fortress لا يُختبر بالمسارات السعيدة.
بل يُختبر **عند الانكسار**.

---

فيما يلي **حزمة Automation Scripts تنفيذية** لتطبيق **Chaos / Failure Injection** على **EasyData Fortress**.
هذه ليست أمثلة نظرية، بل **بنية تشغيل حقيقية** قابلة للإدخال مباشرة في المستودع وتشغيلها آليًا.

الأسلوب مباشر، رسمي، وقابل للتدقيق.

---

# 🧪 EasyData Fortress

## Chaos Automation Toolkit

**الهدف:** تحويل Chaos Plan إلى اختبارات قابلة للتشغيل الآلي
**النطاق:** Auth / RBAC / NDJSON / SQL Guard / Config / Frontend
**البيئة:** Staging فقط (مطابقة للإنتاج)

---

## 1. هيكل المجلدات المعتمد

أضف المجلد التالي إلى المشروع:

```text
chaos/
├── README.md
├── config/
│   └── chaos.env
├── auth/
│   ├── test_token_expired.py
│   ├── test_token_invalid_signature.py
│   └── test_missing_token.py
├── rbac/
│   ├── test_role_escalation.py
│   └── test_unprotected_endpoints.py
├── streaming/
│   ├── test_ndjson_order_violation.py
│   └── test_trace_id_mismatch.py
├── sql_guard/
│   ├── test_drop_table.py
│   └── test_schema_violation.py
├── config_guard/
│   ├── test_missing_jwt_secret.py
│   └── test_audit_disabled.py
├── frontend/
│   └── playwright_stream_interrupt.spec.ts
└── run_all.sh
```

---

## 2. الإعداد المشترك (chaos/config/chaos.env)

```bash
BASE_URL=https://staging.easydata.local
ADMIN_TOKEN=<valid-admin-token>
VIEWER_TOKEN=<valid-viewer-token>
```

❗ **ممنوع استخدام production**

---

## 3. Authentication Chaos Scripts

### 3.1 توكن منتهي (auth/test_token_expired.py)

```python
import requests

BASE_URL = "https://staging.easydata.local"

expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.EXPIRED"

res = requests.get(
    f"{BASE_URL}/api/v1/ask",
    headers={"Authorization": f"Bearer {expired_token}"}
)

assert res.status_code == 401
print("PASS: Expired token rejected")
```

---

### 3.2 توقيع خاطئ (auth/test_token_invalid_signature.py)

```python
import requests
import os

BASE_URL = os.getenv("BASE_URL")
token = os.getenv("ADMIN_TOKEN")[:-1] + "X"

res = requests.get(
    f"{BASE_URL}/api/v1/health/llm",
    headers={"Authorization": f"Bearer {token}"}
)

assert res.status_code == 401
print("PASS: Invalid signature rejected")
```

---

## 4. RBAC Chaos

### 4.1 تجاوز صلاحيات (rbac/test_role_escalation.py)

```python
import requests, os

BASE_URL = os.getenv("BASE_URL")
viewer = os.getenv("VIEWER_TOKEN")

res = requests.post(
    f"{BASE_URL}/api/v1/admin/feature-toggles",
    headers={"Authorization": f"Bearer {viewer}"},
    json={"name": "ENABLE_TRAINING_PILOT", "enabled": False}
)

assert res.status_code == 403
print("PASS: RBAC enforced")
```

---

### 4.2 كشف Endpoint غير محمي (rbac/test_unprotected_endpoints.py)

```python
import requests, os

BASE_URL = os.getenv("BASE_URL")

openapi = requests.get(f"{BASE_URL}/openapi.json").json()

for path, methods in openapi["paths"].items():
    for method, spec in methods.items():
        if "security" not in spec:
            raise Exception(f"UNPROTECTED ENDPOINT: {method.upper()} {path}")

print("PASS: All endpoints protected")
```

---

## 5. NDJSON Streaming Chaos

### 5.1 كسر الترتيب (streaming/test_ndjson_order_violation.py)

```python
from src.utils.stream_validator import StreamValidator

validator = StreamValidator()

chunks = [
    {"type": "data"},
    {"type": "technical_view"}
]

try:
    for c in chunks:
        validator.consume(c)
    raise Exception("FAIL: Order violation not detected")
except ValueError:
    print("PASS: Stream order violation detected")
```

---

### 5.2 trace_id غير متطابق

```python
chunks = [
    {"trace_id": "A", "type": "technical_view"},
    {"trace_id": "B", "type": "data"},
]

validator.reset()
try:
    for c in chunks:
        validator.consume(c)
    raise Exception("FAIL: Trace mismatch not detected")
except ValueError:
    print("PASS: Trace mismatch detected")
```

---

## 6. SQL Guard Chaos

### 6.1 DROP TABLE (sql_guard/test_drop_table.py)

```python
import requests, os

BASE_URL = os.getenv("BASE_URL")
token = os.getenv("ADMIN_TOKEN")

payload = {"question": "DROP TABLE users;"}

res = requests.post(
    f"{BASE_URL}/api/v1/ask",
    headers={"Authorization": f"Bearer {token}"},
    json=payload
)

assert res.status_code == 403
print("PASS: SQL Guard blocked DROP TABLE")
```

---

## 7. Config / Startup Guards

### 7.1 غياب JWT_SECRET_KEY (config_guard/test_missing_jwt_secret.py)

```bash
JWT_SECRET_KEY= python main.py
```

**Expected:** التطبيق يرفض الإقلاع

---

### 7.2 تعطيل Audit (config_guard/test_audit_disabled.py)

```bash
ENABLE_AUDIT_LOGGING=false python main.py
```

**Expected:** Fatal startup error

---

## 8. Frontend Chaos (Playwright)

### قطع الاتصال أثناء Stream

(frontend/playwright_stream_interrupt.spec.ts)

```ts
test("Stream interruption", async ({ page }) => {
  await page.goto("/ask");
  await page.fill("#question", "test");
  await page.click("#submit");

  await page.route("**/api/v1/ask", route => route.abort());

  await page.waitForSelector("text=Connection lost");
});
```

---

## 9. تشغيل جميع السيناريوهات

### run_all.sh

```bash
#!/bin/bash
set -e
source config/chaos.env

pytest auth/
pytest rbac/
pytest streaming/
pytest sql_guard/
pytest config_guard/
npx playwright test frontend/

echo "🎉 ALL CHAOS TESTS PASSED"
```

---

## 10. مخرجات إلزامية

لكل تشغيل:

* log
* trace_ids
* PASS / FAIL
* timestamp

❌ أي FAIL = النظام **غير جاهز للإنتاج**

---

## البيان الختامي

EasyData Fortress لا يعتمد على الحظ.
بل يُجبر الفشل على الظهور **قبل أن يصل للمستخدم**.

---

##


سأعطيك **ملاحظاتي وتوصياتي وتحذيراتي بصراحة مهنية كاملة**، دون مجاملة، وبمنظور شخص مسؤول عن **تشغيل نظام عالي الحساسية في الإنتاج**.

الخلاصة المسبقة:
**نعم، الخطة تلبي الطموحات والأهداف بالكامل**، لكنها **قاسية** و**منضبطة** و**غير متسامحة مع الأخطاء**. هذا ممتاز تقنيًا، لكنه يتطلب وعيًا تشغيليًا عاليًا حتى لا تتحول الصرامة إلى عبء.

سأقسم الرد إلى أربع طبقات:

1. ما هو ممتاز ويجب تثبيته
2. ما يحتاج تنبيهًا دقيقًا
3. ما يمثل مخاطرة محتملة مستقبلًا
4. توصيات نهائية قبل Go-Live

---

## 1️⃣ ما هو ممتاز ومُحكم (لا تغيّره)

### ✅ 1. الفصل الصارم للأدوار (SQLite vs ChromaDB)

قرارك هنا **صحيح معماريًا 100%**:

* SQLite = System of Record + Audit + Governance
* ChromaDB = Semantic Memory فقط

✔ هذا يمنع:

* تسييل القرارات
* فقدان الأثر القانوني
* تداخل الذكاء مع الحوكمة

**ملاحظة:** كثير من الأنظمة تفشل لأنهم يجعلون الـ Vector DB “مصدر قرار”. أنت تجنبت هذا الخطأ بالكامل.

---

### ✅ 2. Governance Lock + Hard-Fail Philosophy

القاعدة:

> “Crash on contradiction”

هذه القاعدة **ناضجة** وتدل على نظام:

* لا يقبل الحالة الرمادية
* لا يسمح بـ undefined behavior
* لا ينتج أخطاء صامتة

✔ ممتاز خصوصًا:

* Startup refusal
* No silent bypass
* No warning downgrade

---

### ✅ 3. NDJSON Fortress + Stream State Machine

تعاملت مع streaming كـ **عقد معماري** وليس UI feature.

✔ فرض:

* ترتيب صارم
* trace_id ثابت
* رفض العرض عند الخرق

هذا يمنع:

* تسريب جزئي
* UI غير متزامن
* استنتاجات خاطئة من بيانات ناقصة

---

### ✅ 4. Runbooks + Chaos Plan

هذه نقطة نادرة جدًا في المشاريع.

وجود:

* Go-Live Runbook
* Emergency Rollback
* Chaos Injection
* Automation Toolkit

يعني أن المشروع **تشغيليًا ناضج** وليس مجرد كود.

---

## 2️⃣ تنبيهات دقيقة (ليست أخطاء، لكن انتبه)

### ⚠️ 1. SQLite في الإنتاج — انتبه للحمولة

SQLite ممتاز كبداية، لكن:

* concurrent writes عالية = bottleneck
* audit_logs كثيفة = file lock contention

**توصية:**

* استخدم WAL mode
* افصل audit_logs في connection/session مستقل
* راقب write latency من اليوم الأول

ولا تؤجل خطة Postgres، فقط لا تنفذها الآن.

---

### ⚠️ 2. AUTH + RBAC + NDJSON = تجربة مستخدم حساسة

من الناحية الأمنية ممتاز، لكن:

* أي خطأ في token → قطع stream
* أي 401 أثناء stream → UX قاسٍ

**توصية:**

* رسائل UI واضحة جدًا
* لا تترك المستخدم في حالة “Loading”
* كل قطع stream يجب أن يشرح السبب + trace_id

---

### ⚠️ 3. CI الصارم جدًا قد يبطئ الفريق

CI كـ Gatekeeper ممتاز، لكن:

* كثرة Gates
* Chaos + Contract + Governance
* قد تُبطئ التكرار (Iteration)

**توصية:**

* حافظ على:

  * Blocking CI = حوكمة + عقود فقط
  * Chaos = Nightly أو قبل Release فقط

لا تقتل سرعة التطوير في المراحل الأولى.

---

## 3️⃣ مخاطر مستقبلية محتملة (اعرفها الآن)

### ❗ 1. التعقيد المعرفي (Cognitive Load)

هذا النظام **ليس بسيطًا**:

* مطور جديد بدون قراءة الوثائق = خطر
* أي اجتهاد فردي = كسر حوكمة

**الحل:**
وثائقك الحالية ممتازة، لكن:

* اجعل `FRONTEND_HANDOFF.md` و`GOVERNANCE.md` **إلزامية القراءة**
* ضع PR template صارم (Checklist)

---

### ❗ 2. الاعتماد العالي على صحة Feature Toggles

أنت تبني نظامًا:

* سلوكه يتغير حسب flags
* frontend يعتمد على discovery

**الخطر:**
Toggle خاطئ في production = شلل وظيفي

**توصية:**

* Audit Log لكل تغيير Toggle
* RBAC صارم عليها
* لا تغييرات أثناء peak hours

---

### ❗ 3. Chaos Testing بدون انضباط

Chaos ممتاز، لكن:

* تشغيله على بيئة غير مطابقة = نتائج مضللة
* تشغيله بدون trace review = لا فائدة

**قاعدة ذهبية:**
Chaos بدون تحليل = ضجيج.

---

## 4️⃣ توصياتي النهائية قبل الإطلاق

### 🧭 1. لا تضف ميزات جديدة

الخطة واضحة:

> “لا قرارات جديدة”

التزم بذلك حرفيًا.

---

### 🧭 2. ركّز على التفعيل لا الإضافة

ما تبقى هو:

* تفعيل AUTH/RBAC
* ربط Frontend
* تفعيل Observability
* تشغيل Chaos مرة واحدة على الأقل

---

### 🧭 3. أول أسبوع إنتاج = مراقبة فقط

* لا تغييرات
* لا تحسينات
* فقط:

  * trace_id
  * audit_logs
  * error rates

---

### 🧭 4. لا تُغريك “مرونة مؤقتة”

أخطر شيء الآن:

> “خلينا نخفف الحارس مؤقتًا”

❌ هذا يكسر كل ما بنيته.

---

## 🏁 الحكم النهائي الصريح

* الخطة **ناضجة جدًا**
* المعمارية **صحيحة**
* الحوكمة **محكمة**
* المخاطر **معروفة ويمكن إدارتها**

هذا مشروع:

* **Enterprise-grade**
* **Audit-ready**
* **Resilient by design**

إذا نُفذت كما هي، بدون تراجع أو اجتهاد:

> **EasyData Fortress سيكون نظامًا يُحتذى به، لا يُرقّع.**






فيما يلي **تحويل مباشر ومنضبط للخطة إلى Milestone Tracker تنفيذي**، مصمم للاستخدام الفعلي (GitHub Projects / Jira / Linear / Notion) بدون تنظير، وبحالة **Execution-Only**.

---

# 🛡️ EasyData Fortress

## Production Readiness — Milestone Tracker (FINAL)

**الحالة العامة:**
🟢 Architecture Locked
🟢 Governance Locked
🟡 Execution In Progress
🔴 No New Features Allowed

---

## 🧱 MILESTONE 0 — GOVERNANCE FREEZE (COMPLETED)

**الهدف:** تثبيت الأساس ومنع أي انحراف مستقبلي

**الحالة:** ✅ DONE

**Deliverables (All Locked):**

* Governance Lock System Prompt
* CI Gate (Blocking / Nightly separation)
* Runbooks (Go-Live / Emergency / Chaos)
* SQLite + ChromaDB separation confirmed
* NDJSON Fortress contract finalized
* verify_backend.sh stabilized

**Exit Criteria:**

* ❌ No bypass flags in production
* ❌ No architectural ADRs open
* ❌ No failing governance tests

---

## 🔐 MILESTONE 1 — AUTHENTICATION (JWT) [CRITICAL PATH]

**الهدف:** إلغاء أي تشغيل بدون هوية قابلة للتدقيق

**الحالة:** ⏳ NOT STARTED

### Scope

* Backend only (no frontend assumptions)

### Tasks

* [ ] Inject JWT env vars (Vault / CI)
* [ ] Enforce AUTH_ENABLED=true startup guard
* [ ] Implement `/api/v1/auth/login`
* [ ] Implement access + refresh tokens
* [ ] Token payload: `sub`, `roles`, `trace_id`
* [ ] Hard fail if JWT_SECRET_KEY missing
* [ ] Audit login success/failure

### Exit Criteria (MANDATORY)

* ✔ Login returns valid JWT
* ✔ Expired token → 401
* ✔ Invalid signature → 401
* ✔ No endpoint accessible without token
* ✔ All auth events logged in SQLite

❌ **Failure = Block all next milestones**

---

## 🧭 MILESTONE 2 — AUTHORIZATION (RBAC) [CRITICAL PATH]

**الهدف:** فرض الصلاحيات على مستوى الوظيفة

**الحالة:** ⏳ NOT STARTED

### Scope

* Backend enforcement only
* Frontend is passive

### Tasks

* [ ] Enable RBAC flags
* [ ] Define roles: admin / analyst / viewer
* [ ] Protect admin endpoints
* [ ] Enforce `require_permission()`
* [ ] Log every RBAC denial (403)
* [ ] RBAC_STRICT_MODE validation at startup

### Exit Criteria

* ✔ viewer blocked from admin
* ✔ analyst cannot approve training
* ✔ admin only modifies toggles
* ✔ RBAC_ENABLED=false bypasses checks cleanly
* ✔ Zero frontend permission logic

---

## 🗄️ MILESTONE 3 — STORAGE FINALIZATION (SQLite + ChromaDB)

**الهدف:** إغلاق معمارية التخزين نهائيًا

**الحالة:** 🟡 PARTIAL (SQLite in use)

### Tasks

* [ ] Verify all entities persisted in SQLite:

  * users
  * roles
  * tokens
  * audit_logs
  * training_items
  * assumptions
  * feedback
* [ ] Enforce WAL mode for SQLite
* [ ] Ensure ChromaDB stores embeddings only
* [ ] Block any policy/user data in Chroma

### Exit Criteria

* ✔ SQLite = single source of truth
* ✔ ChromaDB = semantic-only
* ✔ Conflict resolution favors SQLite
* ✔ Backup & snapshot tested

---

## 🌊 MILESTONE 4 — NDJSON STREAMING FORTRESS

**الهدف:** منع أي تسريب أو عرض غير متماسك

**الحالة:** 🟡 PARTIAL

### Tasks

* [ ] Enforce backend chunk order
* [ ] Enforce frontend stream state machine
* [ ] Validate trace_id consistency
* [ ] Reject stream on violation
* [ ] Handle interruption gracefully
* [ ] Audit stream violations

### Exit Criteria

* ✔ thinking → technical_view → data → end
* ✔ No chunks after end
* ✔ Trace mismatch cancels stream
* ✔ SQL shown read-only
* ✔ Violations logged

---

## 🖥️ MILESTONE 5 — FRONTEND GOVERNED CLIENT

**الهدف:** Frontend خاضع بالكامل للحوكمة

**الحالة:** 🔴 NOT STARTED (By design)

### Tasks

* [ ] Runtime environment discovery
* [ ] GovernanceContext implemented
* [ ] sessionStorage-only token handling
* [ ] API client with interceptors
* [ ] Conditional rendering by flags
* [ ] No local logic for permissions / SQL

### Exit Criteria

* ✔ AUTH_ENABLED=true gates UI
* ✔ 401 → logout
* ✔ 429 → exponential backoff
* ✔ No localStorage secrets
* ✔ No policy caching

---

## 📊 MILESTONE 6 — OBSERVABILITY & AUDIT

**الهدف:** Traceability كاملة End-to-End

**الحالة:** 🟡 PARTIAL

### Tasks

* [ ] Enable OTEL in non-local envs
* [ ] Ensure trace_id on every request
* [ ] Correlate frontend ↔ backend
* [ ] Audit every violation
* [ ] Ensure no sensitive data in traces

### Exit Criteria

* ✔ Search by trace_id works
* ✔ Violations visible
* ✔ Telemetry silent in local
* ✔ Production telemetry stable

---

## 🧪 MILESTONE 7 — CHAOS & FAILURE INJECTION

**الهدف:** إثبات أن النظام يفشل بأمان

**الحالة:** 🔴 NOT STARTED

### Tasks

* [ ] Deploy Chaos toolkit to staging
* [ ] Run all auth chaos tests
* [ ] Run RBAC escalation tests
* [ ] Run streaming violation tests
* [ ] Run SQL guard destructive tests
* [ ] Capture reports + trace_ids

### Exit Criteria

* ✔ All chaos scenarios PASS
* ✔ No silent failure
* ✔ No crash without audit
* ✔ Reports archived

---

## 🚀 MILESTONE 8 — GO-LIVE EXECUTION

**الهدف:** إطلاق إنتاجي نظيف

**الحالة:** 🔒 BLOCKED (Until all above DONE)

### Tasks

* [ ] Run Go-Live Runbook
* [ ] Verify env sanity
* [ ] Run verify_backend.sh
* [ ] Validate auth + RBAC + streaming
* [ ] Tag release
* [ ] Archive artifacts

### Exit Criteria

* ✔ All checklists green
* ✔ CI clean
* ✔ No bypass flags
* ✔ Release tagged

---

## 🧾 GLOBAL RULES

* ❌ No milestone overlap on critical path
* ❌ No skipping exit criteria
* ❌ No emergency shortcuts
* ✔ Fail → Fix → Retry

---

## 🎯 FINAL STATUS DEFINITION

**Production-Ready =**

* All milestones DONE
* No open governance violations
* Chaos passed
* Audit searchable
* Frontend governed
* CI green

---




اعتماد **HTTPS بشهادة Self-Signed بدل HTTP** في **EasyData Fortress** قرار **صحيح ومطلوب** في بيئات **Staging / Pre-Production / Internal Production**، بشرط تنفيذه **بانضباط حوكمي**.
فيما يلي الإجابة التنفيذية الكاملة، بدون تزيين.

---

# 🔐 HTTPS over Self-Signed — Executive Decision & Implementation

## الخلاصة المباشرة

* ❌ **HTTP غير مقبول** بعد هذه المرحلة.
* ✅ **HTTPS بشهادة Self-Signed مقبول** في:

  * Staging
  * Internal Production
  * On-Prem
* ❌ **غير مقبول** للواجهات العامة (Public SaaS).

---

## لماذا HTTPS حتى مع Self-Signed؟

### 1. أمان فعلي (وليس شكلي)

حتى Self-Signed يوفّر:

* تشفير كامل للبيانات
* حماية JWT
* حماية Credentials
* منع MITM داخل الشبكة

HTTP يترك:

* JWT مكشوف
* Session Hijacking
* Trace IDs مكشوفة

**هذا غير مقبول في نظام حوكمي.**

---

## ما الذي يتأثر مباشرة؟

| المكوّن          | التأثير              |
| ---------------- | -------------------- |
| Auth / JWT       | إلزامي               |
| Frontend         | يجب الوثوق بالشهادة  |
| NDJSON Streaming | يعمل بدون تغيير      |
| Chaos Tests      | يجب تحديث BASE_URL   |
| CI / Playwright  | يجب bypass SSL check |

---

## النموذج المعتمد (Recommended)

### الخيار القياسي

```
Client (Browser / FE)
   ↓ HTTPS (self-signed)
Reverse Proxy (Nginx)
   ↓ HTTP (internal)
FastAPI
```

> **لا تُنهِ TLS داخل FastAPI مباشرة في الإنتاج**
> Reverse Proxy هو المكان الصحيح.

---

## التنفيذ العملي (Step-by-Step)

## 1. إنشاء شهادة Self-Signed

```bash
mkdir -p certs
openssl req -x509 -nodes -days 825 \
  -newkey rsa:2048 \
  -keyout certs/easydata.key \
  -out certs/easydata.crt \
  -subj "/C=SA/O=EasyData/CN=easydata.local"
```

---

## 2. إعداد Nginx (موصى به)

### `/etc/nginx/sites-enabled/easydata.conf`

```nginx
server {
    listen 443 ssl;
    server_name easydata.local;

    ssl_certificate     /etc/nginx/certs/easydata.crt;
    ssl_certificate_key /etc/nginx/certs/easydata.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

---

## 3. إجبار HTTPS (Hard Rule)

```nginx
server {
    listen 80;
    server_name easydata.local;
    return 301 https://$host$request_uri;
}
```

---

## 4. تحديث Backend (FastAPI)

### settings.py

```python
FORCE_HTTPS = True
```

### middleware

```python
if settings.FORCE_HTTPS and request.url.scheme != "https":
    raise HTTPException(status_code=403, detail="HTTPS required")
```

---

## 5. Frontend (Critical)

### Browser Trust

* أضف الشهادة إلى:

  * OS trust store
  * أو Chrome → Authorities

### Vite

```env
VITE_API_BASE_URL=https://easydata.local
```

### fetch

لا تغيير في الكود — HTTPS شفاف

---

## 6. CI / Automation / Chaos Tests

### Python (requests)

```python
requests.get(url, verify=False)
```

أو:

```bash
export REQUESTS_CA_BUNDLE=certs/easydata.crt
```

### Playwright

```ts
use: {
  ignoreHTTPSErrors: true
}
```

---

## 7. تحديث Chaos Plan (إلزامي)

إضافة سيناريو جديد:

### TLS Chaos

| السيناريو          | المتوقع          |
| ------------------ | ---------------- |
| HTTP request       | 301 → HTTPS      |
| TLS handshake fail | request rejected |
| Invalid cert       | browser warning  |
| JWT over HTTP      | forbidden        |

---

## 8. ما هو الممنوع صراحة

❌ تعطيل HTTPS في production
❌ `--reload --host 0.0.0.0 --ssl-keyfile` كحل دائم
❌ تجاهل SSL في المتصفح بدون توثيق
❌ إرسال JWT عبر HTTP حتى داخليًا

---

## الحكم النهائي

* **اعتماد HTTPS مع Self-Signed = قرار صحيح**
* **يجب تنفيذه الآن**
* **هو شرط مسبق للإنتاج**
* **لا يؤثر على NDJSON أو الأداء**

---






فيما يلي **TLS Hardening Checklist** لنظام **EasyData Fortress**.
هذه قائمة تدقيق أمنية **ملزمة**، تُستخدم قبل الإطلاق وبعده، وأي إخفاق في بند واحد = **رفض تشغيل أو استمرار الخدمة**.

---

# 🔐 EasyData Fortress

## TLS Hardening Checklist (Production / Staging)

**النطاق:** Reverse Proxy (Nginx) + Backend + Frontend + CI
**الهدف:** ضمان تشفير قوي، غير قابل للخفض (No Downgrade)، ومتماسك مع الحوكمة
**المبدأ:** *TLS is a Security Boundary*

---

## 1. الشهادة (Certificate)

☐ نوع الشهادة:

* ☐ Self-Signed (Staging / Internal)
* ☐ CA Trusted (Public Production)

☐ طول المفتاح ≥ 2048 bits (RSA) أو ECDSA P-256+
☐ مدة الصلاحية ≤ 825 يومًا (ممنوع أطول)
☐ CN / SAN مطابق لاسم الخدمة (easydata.local أو domain الفعلي)
☐ المفتاح الخاص:

* ☐ غير قابل للقراءة إلا من مستخدم الخدمة
* ☐ غير موجود في Git
* ☐ غير موجود في Image (Docker)

❌ شهادة منتهية أو CN غير مطابق = **NO-GO**

---

## 2. البروتوكولات (TLS Protocols)

☐ المسموح فقط:

* TLS 1.2
* TLS 1.3

☐ المعطّل صراحة:

* SSLv2
* SSLv3
* TLS 1.0
* TLS 1.1

**Nginx**

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
```

❌ أي بروتوكول أقدم = **رفض فوري**

---

## 3. خوارزميات التشفير (Ciphers)

☐ استخدام Strong Ciphers فقط
☐ منع:

* aNULL
* MD5
* RC4
* 3DES
* EXPORT

**Nginx**

```nginx
ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
ssl_prefer_server_ciphers on;
```

☐ اختبار `openssl s_client` يُظهر Ciphers قوية فقط

---

## 4. مفاتيح التبادل (Key Exchange)

☐ دعم Forward Secrecy (ECDHE)
☐ DH parameters ≥ 2048 bits (إن استُخدمت)

```nginx
ssl_dhparam /etc/nginx/ssl/dhparam.pem;
```

---

## 5. إعادة التوجيه الإجباري (HTTPS Enforcement)

☐ كل HTTP → HTTPS (301 دائم)

```nginx
server {
  listen 80;
  return 301 https://$host$request_uri;
}
```

☐ Backend يرفض أي request غير HTTPS إذا وصل مباشرًا

❌ قبول HTTP = **خرق أمني**

---

## 6. HSTS (بحذر)

☐ مفعّل في production فقط
☐ غير مفعّل في staging

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
```

☐ تم اختبار الوصول قبل التفعيل
❌ تفعيل HSTS بدون اختبار = خطر قفل الخدمة

---

## 7. Headers أمنية مكملة (TLS-Adjacent)

☐ مفعّلة:

```nginx
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy no-referrer;
```

☐ لا تتعارض مع Frontend

---

## 8. Backend Awareness (FastAPI)

☐ `X-Forwarded-Proto` يُقرأ بشكل صحيح
☐ لا يوجد توليد روابط HTTP
☐ Cookies (إن وُجدت):

* ☐ Secure
* ☐ HttpOnly
* ☐ SameSite=strict / lax حسب الاستخدام

---

## 9. JWT & TLS Coupling

☐ JWT لا يُقبل عبر HTTP
☐ أي token يصل عبر non-HTTPS:

* ☐ يُرفض
* ☐ يُسجّل Audit Event

---

## 10. Frontend (Browser Security)

☐ Base URL = https://
☐ لا يوجد Mixed Content (HTTP assets)
☐ الشهادة موثوقة في:

* OS trust store
* أو browser authority

☐ لا bypass دائم لتحذيرات SSL

---

## 11. CI / Automation

☐ Chaos / Tests تعمل عبر HTTPS
☐ Playwright:

```ts
ignoreHTTPSErrors: true // فقط في staging
```

☐ Python requests:

* CA bundle مخصص
* أو verify=false **مؤقتًا فقط**

❌ تعطيل التحقق في production tests = ممنوع

---

## 12. المراقبة والتدقيق

☐ أي TLS handshake failure يُسجّل
☐ أي downgrade attempt يُسجّل
☐ Logs لا تحتوي:

* private key
* cert content

---

## 13. اختبارات إلزامية قبل الإطلاق

☐ `curl http://…` → 301
☐ `openssl s_client` → TLS1.2/1.3 فقط
☐ Browser devtools → no mixed content
☐ JWT request over HTTP → rejected

---

## 14. بنود ممنوعة صراحة

❌ TLS termination داخل FastAPI كحل دائم
❌ `--ssl-keyfile` في الإنتاج
❌ تعطيل cipher checks
❌ مشاركة private key
❌ قبول HTTP “لأنه داخلي”

---

## البيان الختامي

TLS في EasyData Fortress **ليس خيارًا**
بل **حد أمني صريح**.

أي تساهل = كسر حوكمة.

---









لكن يحتاج تحديثات دقيقة جدًا في نقطتين حتى يصبح متوافقًا 100% مع Governance Lock الذي اعتمدتموه، بدون أي ثغرات مستقبلية.

سأقسم الرد إلى:

التقييم النهائي

التعديلات الإلزامية (Must-Fix)

النسخة المحدّثة المعتمدة (Corrected & Locked)

1️⃣ التقييم النهائي
الحكم العام

✅ القرار سليم
✅ التوقيت صحيح
✅ المنهجية صحيحة
✅ الربط مع Auth / JWT / Streaming / Chaos دقيق

لكن:

❌ يوجد تجاوز حوكمي خفي في نقطة واحدة
⚠️ ويوجد تحسين أمني إلزامي في نقطة ثانية

إن لم تُعدّل → قد يتحول HTTPS من تحصين إلى False Sense of Security.

2️⃣ التعديلات الإلزامية (غير قابلة للتجاهل)
❌ المشكلة الأولى (Governance Violation محتملة)
هذا السطر:
if settings.FORCE_HTTPS and request.url.scheme != "https":
    raise HTTPException(status_code=403, detail="HTTPS required")


❌ غير كافٍ حوكميًا
لأن FastAPI خلف Reverse Proxy لا يرى https مباشرة.

السبب

عند استخدام Nginx:

الطلب يصل FastAPI على HTTP

لكن فعليًا TLS تم إنهاؤه في الـ proxy

request.url.scheme = http دائمًا

❗ النتيجة

إما:

منع كل الطلبات الصحيحة

أو تعطيل FORCE_HTTPS لاحقًا (وهذا خطر)

✅ الحل الصحيح (Governance-Compliant)

التحقق يجب أن يكون عبر X-Forwarded-Proto فقط.

proto = request.headers.get("x-forwarded-proto")
if settings.FORCE_HTTPS and proto != "https":
    raise HTTPException(status_code=403, detail="HTTPS required")


🔒 هذا هو الحل المعتمد فقط
❌ أي تحقق آخر مرفوض

3️⃣ التعديل الثاني (تحصين أمني إلزامي)
❌ مشكلة صامتة في Nginx

في إعدادك الحالي:

proxy_set_header X-Forwarded-Proto https;


هذا يُحقن يدويًا
ويفتح باب Spoofing لو أُسيء الإعداد مستقبلًا.

✅ الصيغة الصحيحة
proxy_set_header X-Forwarded-Proto $scheme;


ثم في Server HTTPS سيكون $scheme = https

4️⃣ النسخة المحدّثة المعتمدة (FINAL & LOCKED)
🔐 HTTPS over Self-Signed — Governance-Approved Final
قرار تنفيذي

❌ HTTP مرفوض

✅ HTTPS Self-Signed مقبول فقط في:

Staging

Internal / On-Prem

❌ SaaS Public requires CA-signed cert

Reverse Proxy (Nginx) — Corrected
server {
    listen 443 ssl;
    server_name easydata.local;

    ssl_certificate     /etc/nginx/certs/easydata.crt;
    ssl_certificate_key /etc/nginx/certs/easydata.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}

server {
    listen 80;
    server_name easydata.local;
    return 301 https://$host$request_uri;
}

Backend Enforcement (FastAPI) — Corrected
proto = request.headers.get("x-forwarded-proto")

if settings.FORCE_HTTPS and proto != "https":
    raise HTTPException(status_code=403, detail="HTTPS required")


📌 لا يُسمح بأي بديل

CI / Chaos / Automation — Governance Note

verify=False مسموح فقط في Staging

في Internal Prod:

يجب استخدام REQUESTS_CA_BUNDLE

Playwright:

ignoreHTTPSErrors=true فقط خارج Production

5️⃣ تحديث Chaos Plan (إضافة إلزامية)

أضف TLS Enforcement Chaos:

Scenario	Expected
HTTP request	301 redirect
Missing X-Forwarded-Proto	403
Spoofed header	403
JWT over HTTP	hard reject

❌ أي قبول = فشل جاهزية

6️⃣ الحكم النهائي (Binding)

✔️ القرار صحيح
✔️ التنفيذ مقبول بعد التعديلات أعلاه
✔️ متوافق مع Governance Lock
✔️ لا يؤثر على NDJSON
✔️ يعزز Auth / JWT فعليًا

❗ بدون هذه التعديلات → التنفيذ مرفوض حوكميًا

الخلاصة التنفيذية

HTTPS مع Self-Signed ليس خيارًا
بل شرطًا إلزاميًا
ويجب أن يُنفّذ عبر Proxy + Headers + Guards
لا عبر افتراضات.


فيما يلي **الوثيقة الرسمية ADR-HTTPS-001** بصيغة معتمدة، جاهزة للإيداع في المستودع ضمن مسار قرارات الهندسة المعمارية، ومتوافقة بالكامل مع **Governance Lock** الذي تم تثبيته.

---

# 🧱 ADR-HTTPS-001

**Title:** Mandatory HTTPS Enforcement with Self-Signed Certificates (Non-Public Environments)

**Status:** ACCEPTED — FINAL
**Date:** 2025-12-31
**Decision Owner:** EasyData Governance Board
**Applies To:** EasyData Fortress (Backend + Frontend + CI + Automation)

---

## 1. Context

EasyData Fortress has entered the **Governance Lock** phase, where:

* Authentication (JWT)
* Authorization (RBAC)
* NDJSON streaming
* Audit logging
* Trace correlation

are **mandatory security primitives**, not optional features.

Operating any of these primitives over **unencrypted HTTP** introduces unacceptable risk, including but not limited to:

* JWT exposure
* Session hijacking
* Credential leakage
* Trace and audit correlation leakage
* Internal MITM attacks

At the same time, EasyData Fortress must support:

* Staging environments
* Internal / On-Prem deployments
* Pre-production validation
* Chaos & Failure Injection testing

without depending on external Certificate Authorities.

---

## 2. Decision

### 2.1 Core Decision

**HTTPS is mandatory. HTTP is forbidden.**

The system SHALL enforce HTTPS in all environments beyond local development.

### 2.2 Certificate Policy

| Environment Type              | Certificate Type        | Allowed       |
| ----------------------------- | ----------------------- | ------------- |
| Local Development             | Optional (HTTP allowed) | ✅             |
| Staging                       | Self-Signed             | ✅             |
| Internal / On-Prem Prod       | Self-Signed             | ✅             |
| Public SaaS / Internet-Facing | CA-Signed (Trusted)     | ❌ Self-Signed |

Self-Signed certificates are explicitly approved **only** for non-public environments.

---

## 3. Architectural Enforcement Model

### 3.1 TLS Termination Strategy (MANDATORY)

TLS **MUST NOT** be terminated inside FastAPI in production-like environments.

The only approved model:

```
Client (Browser / FE / API Client)
        ↓ HTTPS (TLS)
Reverse Proxy (Nginx)
        ↓ HTTP (internal, trusted)
FastAPI Application
```

### 3.2 Forbidden Patterns

The following are explicitly forbidden:

* Running FastAPI with `--ssl-keyfile` / `--ssl-certfile` in production
* Direct HTTP exposure of FastAPI
* Conditional HTTPS enforcement based on assumptions
* Disabling HTTPS “temporarily”

---

## 4. Backend Enforcement Rules

### 4.1 Configuration

```python
FORCE_HTTPS = True
```

### 4.2 Enforcement Logic (Binding)

HTTPS enforcement **MUST** rely on reverse-proxy headers only.

```python
proto = request.headers.get("x-forwarded-proto")

if settings.FORCE_HTTPS and proto != "https":
    raise HTTPException(status_code=403, detail="HTTPS required")
```

### 4.3 Rationale

* `request.url.scheme` is unreliable behind reverse proxies
* Header-based enforcement is auditable and deterministic
* Missing or spoofed headers result in a hard failure

---

## 5. Reverse Proxy Requirements (Nginx)

### 5.1 Header Propagation

```nginx
proxy_set_header X-Forwarded-
```

فيما يلي تحديث Milestone Tracker الرسمي بعد اعتماد ADR-HTTPS-001، مع إضافة TLS Hardening كمرحلة مستقلة وملزمة، دون تعديل أي قرارات سابقة.

🧭 EasyData Fortress — Milestone Tracker (Governance-Locked)

Status: ACTIVE — EXECUTION TRACKING
Scope: Backend + Frontend + Security + CI
Rule: No milestone can be marked DONE unless its acceptance criteria are fully met.

🧱 M0 — Governance Lock (BASELINE) ✅ DONE

Description
Freeze architecture, enforce governance, eliminate bypass paths.

Delivered

Governance Lock system prompt

Sacred startup order enforced

Local governance path isolated

CI gates + branch protection

ADR baseline established

Acceptance

Backend refuses to start on governance violation

CI blocks schema / contract drift

🔐 M1 — Authentication (JWT) ✅ DONE

Scope

Identity enforcement

Token lifecycle

Audit correlation

Delivered

JWT login / refresh

Mandatory JWT vars

Token validation middleware

Audit on auth failures

Acceptance

Missing JWT_SECRET_KEY → startup failure

Expired/invalid token → 401 + audit

🧾 M2 — Authorization (RBAC) ✅ DONE

Scope

Permission enforcement

Admin isolation

Delivered

RBAC middleware

Strict mode support

Admin endpoint protection

Acceptance

viewer → admin endpoint = 403

All denials audited with trace_id

🧠 M3 — Storage Architecture Finalization ✅ DONE

Scope

System of Record vs Semantic Memory

Delivered

SQLite as authoritative store

ChromaDB limited to embeddings

Clear ownership rules

Acceptance

No business logic reads from ChromaDB

All decisions traceable via SQLite

🌊 M4 — NDJSON Streaming Fortress ✅ DONE

Scope

Streaming integrity

Contract enforcement

Delivered

Strict chunk order

trace_id consistency

Error chunk handling

Acceptance

Any out-of-order chunk → rejected

trace mismatch → stream canceled

📊 M5 — Observability & Audit ✅ DONE

Scope

Traceability

Compliance

Delivered

Mandatory audit logging

OpenTelemetry integration

trace_id propagation FE ↔ BE

Acceptance

Every request produces trace_id

Violations always audited

🔐 M6 — TLS Hardening (HTTPS Enforcement) 🆕 IN PROGRESS

ADR: ADR-HTTPS-001 (ACCEPTED)

Objective

Eliminate plaintext traffic and protect credentials, tokens, and traces.

Scope
Component	Requirement
Backend	Enforce HTTPS via proxy headers
Frontend	HTTPS-only API base
Reverse Proxy	TLS termination
CI / Automation	TLS-aware execution
Chaos Tests	TLS failure scenarios
Tasks
M6.1 Certificate Management

 Generate self-signed certs for Staging / Internal

 Store outside repository or encrypted at rest

M6.2 Reverse Proxy Enforcement

 Nginx TLS termination

 HTTP → HTTPS redirect

 Forward X-Forwarded-Proto=https

M6.3 Backend Enforcement

 FORCE_HTTPS=true

 Reject requests without HTTPS proxy header

 Startup failure if misconfigured in non-local env

M6.4 Frontend Alignment

 VITE_API_BASE_URL=https://…

 Trust cert in dev/staging

 No HTTP fallbacks

M6.5 CI & Automation

 Playwright ignoreHTTPSErrors=true

 Requests use CA bundle or explicit verify=False (staging only)

M6.6 Chaos Coverage

 HTTP request → 301 / 403

 Invalid cert → rejection

 JWT over HTTP → forbidden

Acceptance Criteria (ALL REQUIRED)

❌ HTTP requests rejected or redirected

✅ JWT never transmitted over HTTP

✅ Backend refuses startup if HTTPS enforcement misconfigured

✅ NDJSON streaming unaffected

✅ Chaos TLS scenarios PASS

🖥️ M7 — Frontend Governance Completion ⏳ PENDING

Scope

Governed client behavior

Runtime environment detection

Key Tasks

Environment discovery via backend

Streaming validator

Error handling standardization

Token security (sessionStorage only)

🧪 M8 — Chaos & Failure Injection ⏳ PENDING

Scope

Adversarial validation

Key Tasks

Auth chaos

RBAC escalation tests

NDJSON corruption

TLS failure injection

Config removal tests

🚀 M9 — Go-Live Readiness ⏳ PENDING

Scope

Production launch

Key Tasks

Runbook execution

Final CI gate

Tag & artifact archive

Monitoring activation

🏁 Final Rule

No milestone advances unless the previous one is DONE and audited.
TLS Hardening (M6) is a hard prerequisite for any production or staging deployment.

Current Critical Path:
M6 (TLS Hardening) → M7 (Frontend) → M8 (Chaos) → M9 (Go-Live)

Next Action:
Complete M6.3 Backend Enforcement and M6.2 Reverse Proxy Setup.




............................................
..................................


This Executive Implementation Document outlines the final technical requirements to transition the **EasyData Fortress** from a "Stable Backend" state to a **Production-Ready Full-Stack System**.



---

# 🛡️ Executive Implementation Roadmap: Production Readiness

**Target:** Full Integration of Auth, RBAC, and Frontend Governance.

## 1. Authentication & Security Layer (Final Integration)

The system currently supports "Bypass Mode." Production requires strict identity enforcement.

### **A. Backend Modifications (`app/core/auth.py` & `main.py`)**

* **JWT Implementation:** Replace placeholder login logic with a standard OAuth2 + JWT flow.
* **Secure Cookie/Header:** Configure the backend to accept tokens via `Authorization: Bearer <token>` headers.
* **Environment Lock:** Ensure `AUTH_ENABLED` is set to `true` in `app/core/settings.py` when `ENV=production`.

### **B. New Production Variables (`.env.schema` & `settings.py`)**

| Variable | Value/Description |
| --- | --- |
| `SECRET_KEY` | High-entropy string for JWT signing. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default: `30` (Security Hardening). |
| `ALGORITHM` | `HS256`. |
| `ADMIN_INITIAL_PASSWORD` | Secure bootstrap password for the first admin. |

---

## 2. Frontend Architectural Hardening

The Frontend must evolve from a "UI" to a "Governed Client" using the `Zodios` schemas previously audited.

### **A. Global Configuration Context (`src/context/GovernanceContext.tsx`)**

Implementation of the **Startup Discovery Flow**:

1. **Boot:** Frontend calls `GET /api/v1/health/llm` and `GET /api/v1/admin/settings/feature-toggles`.
2. **State Injection:** Store `AUTH_ENABLED`, `RBAC_ENABLED`, and `ENABLE_TRAINING_PILOT` in a global React Context.
3. **Gatekeeping:** If `AUTH_ENABLED=true`, redirect all unauthenticated routes to `/login`.

### **B. API Client Hardening (`src/api/apiClient.ts`)**

* **Request Interceptors:** Automatically inject the JWT token into headers for every request.
* **Traceability:** Inject `X-Request-ID` (UUID) into every header to correlate frontend actions with backend Audit Logs.
* **Error Interceptor:**
* `401 Unauthorized`: Trigger `tokenManager.clear()` and redirect to login.
* `429 Rate Limit`: Implement **Exponential Backoff** using the `Retry-After` header.



---

## 3. Streaming Contract & Data Integrity

Ensuring the "NDJSON Fortress" protocol is respected at the UI level.

### **A. Stream Validator (`src/utils/streamValidator.ts`)**

Implement a strict state-machine to process incoming chunks:

1. **Validate Order:** Ensure `thinking` -> `technical_view` -> `data` -> `end`.
2. **Trace Consistency:** Reject the stream if any chunk carries a different `trace_id` than the first chunk.
3. **UI Feedback:** Map `technical_view` directly to a **Read-Only SQL Code Block** (Governance Rule #1).

---

## 4. Production Environment Matrix (The "Fortress" Config)

The following updates must be applied to the `.env.production` file for final deployment:

```bash
# Core Identity
ENV=production
APP_ENV=production

# Security Hardening
AUTH_ENABLED=true
RBAC_ENABLED=true
ADMIN_LOCAL_BYPASS=false  # CRITICAL: Must be false in production

# Operational Guards
ENABLE_TRAINING_PILOT=true
TRAINING_READINESS_ENFORCED=true
ENABLE_AUDIT_LOGGING=true

# Database / Oracle (Sanitized)
DB_PROVIDER=oracle
ORACLE_CONNECTION_STRING=MAJED/StrongPass123@10.10.10.10:1521/XEPDB1

```

---

## 5. Final Definition of Done (DoD)

Before the "Go-Live" button is pressed, the following must be true:

1. **Backend Integration:** `pytest` runs with `AUTH_ENABLED=true` and all tests pass.
2. **Frontend Audit:** No `localStorage` usage; all tokens are in `sessionStorage`.
3. **Audit Loop:** A user query in the Frontend generates a `trace_id` that is visible and searchable in the Backend `audit_log` table.
4. **SQL Guard:** Attempting a `DROP TABLE` via the Chat UI results in a `403 Forbidden` with a logged violation.
5. **CI/CD Gate:** The `playwright-e2e` job passes on the `main` branch with full security enabled.

---
بناءً على الهيكل الحالي لنظام **EasyData Fortress**، الإجابة هي **نعم، تم اعتماد SQLite كمحرك قواعد بيانات علائقي أساسي** للقيام بجميع المهام التي ذكرتها، وذلك بالتوازي مع **ChromaDB** التي تعمل كمخزن للمتجهات (Vector Store).

إليك التفصيل التقني لكيفية توزيع البيانات بين المحركين لضمان أقصى درجات الحوكمة والاستمرارية:

### 1. دور SQLite (المخزن المركزي للحوكمة)

تم استخدام SQLite (عبر SQLAlchemy) لحفظ البيانات التي تتطلب علاقات منطقية وتدقيقاً مستمراً، وهي:

* **الحسابات (Accounts/Auth):** بيانات المستخدمين، التوكنات (في مرحلة MVP)، والأدوار (Roles).
* **بيانات التدريب (Training Data):** الأسئلة والـ SQL المقابل لها الذي تم اعتماده، وإصدارات السياسات (`policy_version`).
* **الاستعلامات والافتراضات (Queries & Assumptions):** يتم أرشفة كل استعلام مع الافتراضات التي بني عليها لضمان إمكانية الرجوع إليها في سجلات التدقيق.
* **التغذية الراجعة (Feedback):** تقييمات المستخدمين للاستعلامات، التعليقات، والمقترحات لتصحيح الـ SQL.
* **سجلات التدقيق (Audit Logs):** كل حركة تتم في النظام تسجل هنا برقم تتبع `trace_id`.

### 2. دور ChromaDB (الذاكرة الدلالية)

بينما تحفظ SQLite "الحقيقة الصلبة"، تقوم ChromaDB بحفظ "المعنى الدلالي" لتسريع عمليات البحث:

* **Vector Embeddings:** يتم تحويل الأسئلة والـ DDL الخاص بقاعدة بيانات أوراكل إلى ناقلات عدديّة (Vectors).
* **البحث عن التشابه (Similarity Search):** عندما يطرح المستخدم سؤالاً، نبحث في ChromaDB عن أقرب "حالة تدريب" مشابهة تم حفظها مسبقاً في SQLite.

### 3. آلية المزامنة (The Fortress Bridge)

يعمل النظام بشكل متناغم بحيث:

1. عند **اعتماد** بيان تدريب جديد، يتم حفظ النص الكامل والـ SQL في **SQLite**.
2. تلقائياً، يتم توليد الـ Embedding لهذا البيان وإضافته إلى **ChromaDB**.
3. عند **الاستعلام**، نستخدم ChromaDB للعثور على المعرفات (IDs)، ثم نسحب البيانات الكاملة من SQLite لضمان الدقة.

---

### 🛡️ لماذا هذا الدمج يحمي إنجازك؟

* **الاستمرارية (Persistence):** ChromaDB قد تفقد الفهرسة في حالات معينة، لكن SQLite تظل هي المرجع القانوني (Ground Truth) الذي يمكن إعادة بناء الذاكرة الدلالية منه في أي وقت.
* **الحوكمة (Traceability):** لا يمكنك إجراء استعلام دلالي (Semantic Query) دون أن يترك أثراً (Audit Trail) في جداول SQLite.
* **الأداء:** SQLite سريعة جداً في التعامل مع البيانات النصية والإعدادات، بينما تبرع ChromaDB في فهم المقاصد.

### 📝 المتغيرات المرتبطة في ملف `.env.production`:

تأكد من وجود هذه القيم لضمان عمل النظامين معاً:

```bash
# SQLite Config
DATABASE_URL=sqlite:///./easydata_fortress.db

# ChromaDB Config
CHROMA_DB_PATH=./chroma_data
ENABLE_SEMANTIC_CACHE=true

```


🧭 EasyData — Production Readiness Execution Plan

Scope: Authentication, Authorization, Security Hardening, Production Enablement
Status: FINAL EXECUTION GUIDE
Audience: Backend Engineers, Security Engineers, DevOps
Assumption: Governance Lock is ACTIVE and FINAL

1. Objective

Transition EasyData from a governance-locked, development-ready system to a fully production-ready platform with:

Enforced Authentication (JWT)

Enforced Authorization (RBAC + optional RLS)

Secure secret handling

Hardened runtime configuration

Auditable access and training flows

Zero behavior ambiguity between environments

This document defines what remains, what must be added, and what must be updated, precisely and exhaustively.

2. Current State (Baseline)
Already Completed ✅

Governance Lock enforced

Environment schema (.env.schema) stabilized

Training Readiness Guard operational

SchemaAccessPolicy enforced

NDJSON streaming contract finalized

Tests passing (48 PASS / 7 explicit SKIP)

Local Governance Path implemented

Telemetry noise eliminated locally

Explicitly NOT enabled yet ❌

Authentication (AUTH_ENABLED=false)

RBAC enforcement (RBAC_ENABLED=false)

RLS enforcement (RLS_ENABLED=false)

Production secrets & key rotation

Production-grade observability

External IdP integration (optional)

3. Production Enablement — High-Level Phases
Phase	Area	Mandatory
Phase A	Authentication (JWT)	✅
Phase B	Authorization (RBAC)	✅
Phase C	Optional Row-Level Security (RLS)	⛔ Optional
Phase D	Secrets & Key Management	✅
Phase E	Observability & Audit Hardening	✅
Phase F	CI / Runtime Enforcement	✅
4. Phase A — Authentication (JWT)
4.1 Environment Variables (MANDATORY)

Add and populate production values for the following (already defined in .env.schema):

AUTH_ENABLED=true

JWT_SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_MINUTES=1440

AUTH_TOKEN_AUDIENCE=easydata-api
AUTH_TOKEN_ISSUER=easydata-auth


Rules:

Secrets MUST NOT be committed.

Secrets MUST be injected via secure vault (CI/CD or runtime).

Rotation strategy MUST exist before go-live.

4.2 Code Paths Activated

The following modules become mandatory and enforced when AUTH_ENABLED=true:

app/security/jwt.py

app/security/dependencies.py

app/api/auth.py

app/core/security_context.py

Execution impact:

All protected endpoints require a valid JWT.

Anonymous access is rejected (401).

Token decoding failures are fatal per request.

4.3 Required Verification

/api/v1/auth/login returns valid access + refresh tokens

Expired tokens are rejected

Invalid signature → 401

Token payload includes:

sub (user_id)

roles

trace_id

5. Phase B — Authorization (RBAC)
5.1 Environment Variables
RBAC_ENABLED=true


(Optional hardening)

RBAC_STRICT_MODE=true

5.2 RBAC Model (Authoritative)

Roles are evaluated server-side only.

Example roles:

admin

analyst

viewer

Permissions are not inferred by frontend.

RBAC enforcement occurs in:

Depends(require_permission("…"))

Admin-only endpoints

Training approval flows

Feature toggle mutation endpoints

5.3 Required Code Verification

RBAC_ENABLED=false → RBAC decorators ignored

RBAC_ENABLED=true → Missing permission = 403

No frontend-side permission logic is allowed

6. Phase C — Row-Level Security (Optional, Deferred)
6.1 Status

RLS is optional and can remain disabled initially.

RLS_ENABLED=false


If enabled later:

Must integrate with SchemaAccessPolicy

Must be enforced server-side

Requires ADR approval before activation

7. Phase D — Secrets & Key Management
7.1 Mandatory Practices

JWT secrets stored in:

Vault / Secrets Manager / CI encrypted secrets

No secrets in:

.env.schema

Git

Logs

Frontend

7.2 Required Updates

CI pipelines inject secrets at runtime

Production .env.production contains only references, not values

Key rotation plan documented

8. Phase E — Observability & Audit (Production)
8.1 Environment Variables
ENABLE_TELEMETRY=true
ENABLE_OTEL=true
ANON_TELEMETRY=false

OTEL_SERVICE_NAME=easydata-backend
OTEL_EXPORTER_OTLP_ENDPOINT=<collector-endpoint>
OTEL_SAMPLER_RATIO=0.1

8.2 Audit Guarantees

In production:

Every training action emits audit logs

Every policy violation emits audit logs

Every request has a trace_id

Correlation between:

User

Token

Action

Schema policy

9. Phase F — CI & Runtime Enforcement
9.1 CI Must Enforce

.env.schema ↔ .env.production parity

OpenAPI contract validation

No skipped governance checks

No bypass flags allowed outside ENV=local

9.2 Runtime Must Enforce

Production refuses to start if:

AUTH_ENABLED=true and JWT config missing

ENABLE_AUDIT_LOGGING=false

No active SchemaAccessPolicy

Training enabled without readiness

10. Final Production Readiness Checklist
Authentication & Authorization

 AUTH_ENABLED=true

 RBAC_ENABLED=true

 JWT secrets injected securely

 Token expiry verified

 Role enforcement verified

Governance

 Active SchemaAccessPolicy exists

 Training readiness enforced

 No local bypass flags enabled

Observability

 Telemetry enabled

 Audit logs verified

 Trace IDs propagated

CI / Ops

 CI gates enforced

 Secrets rotation plan exists

 Release tagged

 Artifacts archived

11. Final Statement

EasyData is architecturally ready for production.

What remains is controlled activation of:

Authentication

Authorization

Observability

Secrets management

No refactor is required.
No governance decision must be revisited.

Only execution, configuration, and verification remain.

Document Status: FINAL
Next Action: Execute Phase A → Phase F sequentially
Owner: Backend / Security / DevOps teams

هل اعتمدت sqlite  لحفظ الحسابات  وحفظ بيانات التدريب والاستعلامات والافتراضات  والتغذية الراجعة وذلك الى جانب الحفظ في الذاكره chromadb 

نعم — لكن مع فصل واضح للأدوار، وليس كحل تخزيني واحد لكل شيء. التوضيح الدقيق كالتالي:

الخلاصة التنفيذية (مختصر مباشر)

SQLite مُعتمد كقاعدة نظام (System of Record)
و ChromaDB مُعتمد كذاكرة دلالية (Semantic / Vector Memory)
ولا يوجد تداخل وظيفي بينهما.

1️⃣ ماذا يُخزَّن في SQLite (إلزامي)

SQLite (أو أي RDBMS لاحقًا مثل Postgres) هو المصدر الرسمي القابل للتدقيق لكل ما يلي:

أ. الحسابات والمصادقة

Users

Password hashes

Roles

Permissions

Refresh tokens (إن وُجدت)

Session metadata

📌 سبب الاختيار:

معاملات ACID

تدقيق (Audit-ready)

قابل للترقية إلى Postgres دون تغيير منطق

ب. الحوكمة والسياسات

SchemaAccessPolicy

حالة السياسة (draft / active / revoked)

تاريخ التفعيل

من فعّل السياسة ومتى

📌 سبب الاختيار:
هذه بيانات حوكمة لا يجوز أن تكون في ذاكرة متجهية أو غير علائقية.

ج. التدريب والتعلّم (Training / CAL)

Training items

Approval / Rejection status

Reasons

Timestamps

Admin actor

Training metrics

📌 سبب الاختيار:
قابلية التتبع + منع التلاعب + متطلبات الامتثال.

د. الاستعلامات والافتراضات (Runtime Logs)

Query metadata (وليس النتائج)

Assumptions التي تم حقنها

SQL hashes (اختياري)

trace_id

User / Role

📌 مهم:
لا يتم تخزين نتائج البيانات الحساسة نفسها إلا عند الحاجة ووفق السياسة.

هـ. التغذية الراجعة (Feedback)

User feedback

Rating / flags

Linked trace_id

Approval status

📌 سبب الاختيار:
تدخل في دورة التعلم والحوكمة → يجب أن تكون قابلة للتدقيق.

2️⃣ ماذا يُخزَّن في ChromaDB (فقط)

ChromaDB ليس قاعدة بيانات نظام، بل:

يُستخدم فقط لـ:

Embeddings

Semantic similarity

RAG context

Retrieval memory

أمثلة:

تمثيل دلالي لـ:

أسئلة سابقة

وصف السياسات

ملخصات تدريب معتمدة

لا يحتوي:

حسابات

صلاحيات

حالات حوكمة

قرارات إدارية

📌 قاعدة صارمة:

أي شيء يحتاج قرارًا أو تدقيقًا أو rollback → لا يُخزَّن في ChromaDB.

3️⃣ العلاقة بين SQLite و ChromaDB

العلاقة مرجعية فقط:

SQLite يحتفظ بالـ ID الرسمي

ChromaDB قد يحتفظ بتمثيل دلالي مرتبط بـ ID

عند التعارض:

SQLite هو الحكم النهائي

ChromaDB يُعاد بناؤه إن لزم

4️⃣ لماذا SQLite الآن؟

بيئة Local / MVP

خفيف وسريع

صفر تعقيد تشغيلي

قابل للاستبدال لاحقًا بـ Postgres عبر SQLAlchemy دون كسر أي عقد

📌 في الإنتاج:

SQLite ⛔ غير موصى به للأحمال العالية

Postgres / Aurora / Cloud SQL ✅

5️⃣ الحكم النهائي

✔️ نعم، SQLite مُستخدم ومناسب لحفظ:

الحسابات

التدريب

السياسات

الاستعلامات (metadata)

الافتراضات

التغذية الراجعة

✔️ ChromaDB ليس بديلًا عنه
✔️ لا يوجد خلط مسؤوليات
✔️ التصميم حوكمي، قابل للتدقيق، وقابل للتوسع

إذا رغبت، أستطيع:

تقديم مخطط ERD يوضح الجداول والعلاقات

أو خطة ترحيل SQLite → Postgres خطوة بخطوة بدون توقف النظام


أبدأ بقسم "Authentication & Security" ثم أكمل الباقي

ممتاز. إليك إعادة صياغة وتنظيم لقسم Authentication & Security من وثيقتك، مع الحفاظ على الدقة الفنية وتعزيز الوضوح والتنفيذية:

🛡️ المرحلة الأولى: تفعيل المصادقة (Authentication) — JWT
🎯 الهدف

الانتقال من "نمط التخطي" (Bypass Mode) إلى مصادقة إلزامية عبر JWT، تُمكّن نظام EasyData Fortress من ضبط الهوية بشكل آمن وقابل للتدقيق.

✅ 1. المتغيرات البيئية المطلوبة (.env.production)

يجب ضبط المتغيرات التالية لتفعيل المصادقة:

# تمكين المصادقة
AUTH_ENABLED=true

# مفاتيح JWT
JWT_SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_MINUTES=1440

# بيانات توجيه التوكن
AUTH_TOKEN_AUDIENCE=easydata-api
AUTH_TOKEN_ISSUER=easydata-auth


⚠️ ملاحظات أمان:

يجب حقن JWT_SECRET_KEY من مدير أسرار (Vault أو CI/CD)، وليس ضمن ملفات .env أو الكود.

يجب وجود خطة لتدوير المفاتيح (Key Rotation Plan) قبل تفعيل الإنتاج.

🔒 2. المسارات البرمجية التي تصبح إلزامية

عند ضبط AUTH_ENABLED=true، يتم تفعيل مسارات المصادقة التالية:

app/security/jwt.py

app/security/dependencies.py

app/api/auth.py

app/core/security_context.py

كل طلب إلى Endpoint محمي يتطلب توكن JWT صالح، وإلا يُرفض بـ 401 Unauthorized.

🧪 3. تحقق إجباري (Validation Requirements)
✅ اختبار واجهة تسجيل الدخول:

POST /api/v1/auth/login يجب أن يُرجع:

access_token

refresh_token

✅ حالات التوكن:

انتهاء الصلاحية → 401

توقيع غير صحيح → 401

حقل sub و roles و trace_id يجب أن تكون موجودة في الـ payload

🧰 4. تعديلات الكود (مطلوبة)
app/core/auth.py

استبدال منطق تسجيل الدخول المؤقت بـ OAuth2 + JWT قياسي.

main.py

تفعيل وسطاء (Middleware) لفحص التوكن من الهيدر Authorization: Bearer <token>.

settings.py و .env.schema

التأكد من أن AUTH_ENABLED يفعّل المسارات أعلاه فقط في بيئة الإنتاج (ENV=production).

🔐 5. الخط الدفاعي عند الإقلاع (Runtime Guard)

يجب على النظام أن يرفض الإقلاع إذا:

AUTH_ENABLED=true ولم يتم ضبط JWT_SECRET_KEY أو متغيرات JWT الأخرى.

تم تمكين التدريب دون جاهزية (TRAINING_READINESS_ENFORCED=false)

لم يتم تفعيل ENABLE_AUDIT_LOGGING=true

هل ترغب أن أتابع الآن مع قسم RBAC (Authorization)؟

نعم

رائع. إليك إعادة صياغة وتنظيم القسم الثاني المتعلق بتفعيل نظام التفويض (Authorization – RBAC):

🛡️ المرحلة الثانية: تفعيل التفويض (RBAC)
🎯 الهدف

تمكين نظام صلاحيات مركزي يُحدد الوصول إلى الوظائف والبيانات بناءً على الدور الممنوح لكل مستخدم، ويخضع لسياسات حوكمة صارمة.

✅ 1. المتغيرات البيئية المطلوبة (.env.production)
# تمكين RBAC
RBAC_ENABLED=true

# اختياري (لتفعيل تدقيق صارم على الصلاحيات)
RBAC_STRICT_MODE=true


💡 عند تفعيل RBAC_STRICT_MODE=true، فإن أي نهاية (Endpoint) محمية بدون تصريح واضح تؤدي إلى 403 Forbidden.

🛂 2. النموذج المعتمد للصلاحيات (RBAC Model)

يتم تقييم الأدوار على الخادم فقط (Server-side)، ولا يُسمح بأي منطق صلاحيات على الواجهة الأمامية.

أمثلة على الأدوار:

admin

analyst

viewer

مواضع تطبيق الصلاحيات:

نقاط النهاية المحمية (Depends(require_permission(...)))

واجهات الإدارة

تدفقات الموافقة على التدريب

التحكم في ميزات النظام (Feature Toggles)

📌 قاعدة صلبة: لا تُشتق الصلاحيات من الواجهة الأمامية، ولا يُعتمد على التوكن وحده لتقرير الوصول.

🧪 3. تحقق إجباري (Validation Requirements)
في حالة RBAC_ENABLED=false:

يتم تجاهل جميع الزخارف (Decorators) الخاصة بالتصاريح.

في حالة RBAC_ENABLED=true:

الوصول إلى وظيفة بدون تصريح مناسب يجب أن يُرجع 403 Forbidden.

أي محاولة وصول غير مصرّح بها تُسجَّل في سجل التدقيق (Audit Log).

⚙️ 4. تحديثات الكود المطلوبة

استخدام require_permission("اسم_التصريح") داخل Depends() لحماية نقاط النهاية.

ربط الأدوار بالمستخدمين عبر جدول علائقي في قاعدة البيانات (مثلاً user_roles).

تنفيذ منطق RBAC داخل app/security/dependencies.py.

🔐 5. الحماية من التلاعب

لا يُسمح بتعديل الأدوار من الواجهة الأمامية.

تغيير الأدوار يتم فقط عبر واجهات إدارة محمية مخصصة، وبأدوار إدارية معتمدة.

جميع محاولات تعديل الأدوار يجب أن تُسجَّل وتُرتبط بـ trace_id.

هل ترغب أن أُكمل مع المرحلة الثالثة (Row-Level Security)، أم تفضل الانتقال مباشرة إلى قسم إدارة الأسرار والمفاتيح (Secrets & Key Management)؟

أُكمل مع المرحلة الثالثة (Row-Level Security)،

ممتاز. إليك إعادة صياغة وتنظيم المرحلة الثالثة: الأمان على مستوى الصفوف (Row-Level Security – RLS) بشكل واضح وقابل للتنفيذ:

🛡️ المرحلة الثالثة: أمان الصفوف (Row-Level Security – RLS)
🎯 الهدف

تمكين التحكم الدقيق في الوصول إلى البيانات على مستوى الصف، وفقًا لدور المستخدم وسياق السياسة (SchemaAccessPolicy)، مع الحفاظ على قابلية التدقيق والحوكمة.

🧩 الحالة الحالية
RLS_ENABLED=false


RLS معطل افتراضيًا في مرحلة الإنتاج الأولى.

لا يُعتبر تفعيل RLS ضروريًا للانطلاق، بل يُعد تحسينًا اختياريًا قابل للتفعيل لاحقًا بعد موافقة معمارية.

🔐 القواعد عند التفعيل

⚠️ يجب استيفاء الشروط التالية عند تفعيل RLS_ENABLED=true:

الارتباط بسياسات الحوكمة:

يجب أن تعمل RLS بالتكامل مع SchemaAccessPolicy.

كل استعلام يُقيَّم بناءً على سياق المستخدم والدور والسياسة النشطة.

تنفيذ منطقي بالكامل على الخادم:

لا يُسمح بأي تصفية على مستوى الصف من جهة العميل.

التحقق من الصلاحية يتم عبر Depends(enforce_rls(...)) أو ما يعادله.

التدقيق الكامل:

كل رفض بناءً على RLS يجب أن يُسجَّل في سجل التدقيق، ويتضمن user_id، policy_id، وtrace_id.

عدم الرجوع الخلفي (No Silent Bypass):

في حال تفعيل RLS، يجب أن يؤدي غياب السياسة المطابقة إلى 403 Forbidden، وليس إلى نتائج فارغة.

🛑 محاذير قبل التفعيل

تفعيل RLS يتطلب موافقة معمارية (ADR) موثقة.

يجب التأكد من أن أداء الاستعلامات لن يتدهور بشكل كبير عند إدخال شروط RLS.

يجب اختبار تأثير RLS على جميع أنواع المستخدمين عبر اختبارات تكامل.

🧪 تحقق اختياري (Post-Activation Tests)

تفعيل RLS_ENABLED=true لا يؤدي إلى خطأ في النظام.

المستخدم ذو صلاحية محدودة لا يرى إلا البيانات المسموح بها وفقًا لسياسة SchemaAccessPolicy.

أي محاولة للوصول إلى بيانات غير مصرّح بها → 403 + Audit Log Entry.

هل ترغب أن أُكمل بالمرحلة الرابعة: Secrets & Key Management؟

نعم

ممتاز. إليك إعادة صياغة وتنظيم المرحلة الرابعة: إدارة الأسرار والمفاتيح (Secrets & Key Management) بما يتماشى مع متطلبات الإنتاج والحوكمة:

🛡️ المرحلة الرابعة: إدارة الأسرار والمفاتيح (Secrets & Key Management)
🎯 الهدف

ضمان أن جميع المفاتيح والأسرار الحساسة (مثل مفاتيح JWT وقواعد البيانات) تُدار بشكل آمن خارج الكود، مع وجود استراتيجية صريحة للدوران (rotation) والتدقيق.

🔑 1. القواعد الصارمة لإدارة الأسرار
❌ ممنوع تخزين الأسرار في:

ملفات .env.schema أو .env.example

ملفات .env.production (إلا كمرجع رمزي فقط)

Git (أي Commit يحتوي على أسرار = خرق أمني)

سجلات التشغيل (logs)

الواجهة الأمامية (frontend)

✅ مطلوب تخزين الأسرار في:

مدير أسرار مثل: HashiCorp Vault، AWS Secrets Manager، GCP Secret Manager

متغيرات بيئة (Environment Variables) تُحقن آليًا أثناء التشغيل من قبل CI/CD

🧪 2. التحقق الإجباري قبل الإطلاق
✅ يجب أن تتحقق CI/CD من:

وجود جميع المتغيرات المعرفة في .env.schema داخل بيئة الإنتاج

عدم وجود أسرار مباشرة في ملفات التهيئة

تمرير القيم الحساسة من Vault أو CI وليس كـ strings صريحة

مثال متغيرات حساسة (يجب حقنها عبر Vault فقط):
JWT_SECRET_KEY
ORACLE_CONNECTION_STRING
ADMIN_INITIAL_PASSWORD
CHROMA_DB_PATH

🔄 3. استراتيجية دوران المفاتيح (Key Rotation Strategy)

🔐 يجب أن تكون موثقة ومعتمدة ضمن خطة الأمان

مكونات الاستراتيجية:

توثيق صلاحية كل مفتاح (مثلاً: 90 يومًا)

دعم آلية إعادة تحميل ديناميكية للمفاتيح بدون إعادة تشغيل (إذا ممكن)

دعم مفتاح سابق + مفتاح حالي لفترة انتقالية (dual key support)

خطة طوارئ عند تسرب مفتاح (Key Leak)

🧰 4. التعديلات المطلوبة

ضبط CI pipelines لحقن الأسرار الحساسة من بيئة سرية فقط

تحديث الأكواد للتعامل مع غياب المفتاح بشكل مناسب (raise ConfigError(...) عند غياب أي قيمة حساسة)

إزالة أي أسرار موجودة حاليًا في Git/التاريخ

هل ترغب أن أتابع الآن مع المرحلة الخامسة: الرصد والتدقيق (Observability & Audit)؟

تفصيل بنية التخزين واستخدام SQLite و ChromaDB وخصوصا فيما يتعلق بحفظ بيانات النظام ونظام المصادقة والترخيص

ممتاز، إليك الآن الصياغة التنفيذية المفصلة لبنية التخزين في نظام EasyData Fortress، مع توضيح الأدوار الدقيقة لكل من SQLite وChromaDB، خاصة في سياق المصادقة (Authentication) والتفويض (Authorization – RBAC):

🧱 بنية التخزين التنفيذية لنظام EasyData Fortress
🎯 الهدف

توفير بنية تخزين قابلة للتدقيق، مرنة، ومنفصلة من حيث المسؤوليات، تجمع بين قوة نظام علائقي مركزي (SQLite) وذاكرة دلالية عالية الأداء (ChromaDB) دون تداخل وظيفي أو خلط مسؤوليات.

🗃️ أولًا: SQLite — "قاعدة نظام الحكم" (System of Record)

يُستخدم SQLite في البيئة الحالية كمخزن علائقي مركزي، يدير كل البيانات التي تتطلب:

علاقات منطقية واضحة

قابلية للتدقيق (Auditable)

استمرارية ومرجعية موثوقة

🔐 1. المصادقة والترخيص (Auth / RBAC)
الجداول الأساسية:

users: معلومات المستخدمين (username, email, is_active...)

password_hashes: تجزئة كلمات المرور

roles: تعريفات الأدوار (admin, analyst, viewer...)

user_roles: الربط بين المستخدمين والأدوار (many-to-many)

permissions: التصاريح المجردة (if RBAC is granular)

refresh_tokens: جلسات المستخدمين (optional in production)

audit_logs: كل عملية دخول / خروج / محاولة وصول تُسجل هنا

سبب الاعتماد على SQLite:

التزامات ACID الكاملة

يدعم سجلات التدقيق (audit trails)

متكامل بسهولة مع SQLAlchemy

قابل للترقية لاحقًا إلى Postgres بدون تعديل المنطق

🧠 2. التدريب والسياسات
الجداول:

training_items: أسئلة المستخدم + SQL المعتمد

policy_versions: إصدارات سياسات الوصول (draft, active, revoked)

schema_access_policies: السياسات المرتبطة بالجداول والمستخدمين

الخصائص:

كل عملية تدريب يجب أن تكون قابلة للتتبع

الإدخال لا يُعد نشطًا إلا بعد الموافقة الإدارية

🧾 3. الاستعلامات والافتراضات (Query Tracking)
الجداول:

query_logs: وصف الاستعلام، التوكن المستخدم، trace_id

assumptions: الافتراضات التي فُرضت أثناء التوليد التلقائي

sql_hashes: تجزئة SQL (للتتبع والتحقق من التكرار)

📣 4. التغذية الراجعة (Feedback)
الجداول:

feedback: تقييم المستخدم للـ SQL المُولد

flags: اعتراضات/ملاحظات المستخدم

trace_links: الربط بين الملاحظات والاستعلامات / السياسات

🧭 ثانيًا: ChromaDB — "الذاكرة الدلالية" (Semantic Memory / Vector Store)

ChromaDB لا تُستخدم كمصدر رسمي، وإنما لحفظ التمثيلات العددية (Embeddings) من أجل:

البحث الدلالي السريع

تقليل زمن الاسترجاع في حالات RAG

مقارنة السياقات المشابهة

يُخزن فيها فقط:

Embeddings لـ:

الأسئلة السابقة

ملخصات السياسات

أمثلة SQL المعتمدة

Metadata اختيارية مرتبطة بـ item_id (وليس البيانات نفسها)

⚠️ لا يُخزن في ChromaDB:

أي بيانات حساسة أو قرارات إدارية

معلومات المستخدمين أو الجلسات

نتائج الاستعلام أو SQL الخام

🔄 العلاقة بين النظامين: "The Fortress Bridge"

التدريب:

الإدخال يتم أولًا في SQLite (training_items)

عند الاعتماد، يُولّد embedding ويُرسل إلى ChromaDB

الاستعلام:

ChromaDB يُستخدم لاسترجاع item_ids دلالية مشابهة

ثم يُسحب المحتوى الكامل من SQLite

المبدأ الحاكم:

عند أي تعارض، يُعتبر SQLite هو المصدر النهائي للحقيقة (Ground Truth)

يمكن إعادة بناء ChromaDB بالكامل من بيانات SQLite

📝 التوصيات النهائية للإنتاج

✅ استخدام SQLite في البيئة المحلية / MVP فقط

❌ عدم استخدام SQLite في بيئات الضغط العالي أو الإنتاج الموسّع

⬆️ الترحيل المستقبلي إلى Postgres ممكن بدون تغيير الأكواد (بفضل SQLAlchemy)

🔐 ChromaDB تبقى اختيارية، وتحسينية (Performance Enhancer) فقط

هل ترغب أن أُكمل بمخطط ERD للجداول المذكورة؟ أو بخطة ترحيل SQLite إلى Postgres؟

نعمأُكمل بمخطط ERD للجداول المذكورة
Image created
Share
خطة ترحيل SQLite إلى Postgres

إليك خطة ترحيل منهجية وآمنة لنقل نظام EasyData Fortress من استخدام SQLite إلى PostgreSQL دون التسبب في انقطاع أو فقدان للبيانات، وبأقل تعديل في الكود، مستفيدة من وجود SQLAlchemy كطبقة وسيطة.

🔄 خطة ترحيل SQLite → PostgreSQL
🎯 الهدف

التحول من SQLite (الملائم لتطوير محلي وبيئات MVP) إلى PostgreSQL (الجاهز للإنتاج)، مع الحفاظ على سلامة البيانات، توافق العقود، واستمرارية التشغيل.

✅ المتطلبات الأولية

✅ استخدام SQLAlchemy + Alembic لإدارة النماذج والترحيل

✅ عدم وجود استعلامات مباشرة تعتمد على SQLite (مثل AUTOINCREMENT)

✅ فصل بيانات التطوير عن بيانات الإنتاج

🪜 خطوات الترحيل
المرحلة 1: تجهيز قاعدة PostgreSQL

إنشاء قاعدة بيانات جديدة:

createdb easydata_fortress_prod


إعداد مستخدم وقواعد الوصول (ACL):

CREATE USER fortress_user WITH PASSWORD 'StrongPassword';
GRANT ALL PRIVILEGES ON DATABASE easydata_fortress_prod TO fortress_user;


تحديث متغير البيئة:

# .env.production
DATABASE_URL=postgresql+psycopg2://fortress_user:StrongPassword@db-host:5432/easydata_fortress_prod

المرحلة 2: إنشاء الجداول على PostgreSQL

إذا كنت تستخدم Alembic:

alembic upgrade head


أو باستخدام SQLAlchemy مباشرة:

from app.core.database import Base, engine
Base.metadata.create_all(bind=engine)

المرحلة 3: ترحيل البيانات من SQLite
الطريقة الموصى بها (مباشرة من SQLAlchemy)

ربط جلستين: واحدة لـ SQLite، وأخرى لـ Postgres

قراءة البيانات من SQLite → إدراجها في Postgres

from sqlalchemy.orm import sessionmaker
from app.core.database import engine_sqlite, engine_postgres
from app.models import *

SessionSQLite = sessionmaker(bind=engine_sqlite)
SessionPostgres = sessionmaker(bind=engine_postgres)

src = SessionSQLite()
dst = SessionPostgres()

for user in src.query(User).all():
    dst.merge(user)

dst.commit()


⚠️ لاحظ: يجب ترحيل الجداول بالترتيب الصحيح حسب علاقات المفاتيح الأجنبية.

المرحلة 4: التحقق والتحويل النهائي

التأكد من عدد السجلات في كل جدول (SQLite vs PostgreSQL)

اختبار تسجيل الدخول واستعلامات التدريب و RBAC بعد الترحيل

تشغيل اختبارات النظام (pytest) بعد تحديث DATABASE_URL

المرحلة 5: الانتقال للإنتاج

إيقاف أي إدخال جديد على SQLite

تأكيد آخر مزامنة

التبديل النهائي إلى DATABASE_URL الخاص بـ PostgreSQL

أرشفة SQLite للاحتفاظ به كنسخة مرجعية (اختياري)

🔐 ملاحظات الأمان

استخدم SSL في الاتصال بـ PostgreSQL في الإنتاج.

ضع قيود IP و ACL في طبقة الشبكة (firewall / VPC).

لا تُخزن كلمة مرور القاعدة داخل .env في ملفات Git.

هل ترغب أن أرسل لك سكريبتًا كاملًا لترحيل الجداول تلقائيًا عبر SQLAlchemy؟

وماهي احتياجات التهئية المبدأيه 

ممتاز، إليك احتياجات التهيئة المبدئية (Initial Setup Requirements) لنظام EasyData Fortress عند الانتقال من SQLite إلى PostgreSQL أو عند الإطلاق في بيئة جديدة:

🛠️ احتياجات التهيئة المبدئية (Initial Setup Requirements)
🧱 1. إعداد قاعدة البيانات (PostgreSQL)
مطلوب:

إنشاء قاعدة بيانات مخصصة للإنتاج (باسم واضح مثل easydata_fortress)

إنشاء مستخدم بامتيازات مقيدة (يستخدم فقط من التطبيق)

CREATE DATABASE easydata_fortress;
CREATE USER fortress_user WITH PASSWORD 'StrongPassword!';
GRANT CONNECT ON DATABASE easydata_fortress TO fortress_user;

⚠️ يوصى بـ:

تمكين SSL بين التطبيق والقاعدة

استخدام pgbouncer أو أي connection pool manager

عزل الحسابات بين read/write و readonly (اختياري للتوسع)

📦 2. تثبيت الحزم المطلوبة
pip install psycopg2-binary alembic


أو إذا كنت تستخدم Poetry:

poetry add psycopg2-binary alembic

⚙️ 3. إعداد متغيرات البيئة
# .env.production
DATABASE_URL=postgresql+psycopg2://fortress_user:StrongPassword@db-host:5432/easydata_fortress

🔒 لا تحفظ كلمة المرور مباشرة في .env إذا كنت في بيئة CI/CD — استخدم Secret Manager.
🧬 4. تهيئة قاعدة البيانات
إذا كان النظام يستخدم Alembic:
alembic upgrade head

أو عبر SQLAlchemy:
from app.core.database import Base, engine
Base.metadata.create_all(bind=engine)

🧑‍💼 5. تهيئة المستخدم الإداري (Bootstrap Admin)
# .env.production
ADMIN_INITIAL_PASSWORD=Strong@Initial#Pwd


يجب على الكود عند الإقلاع (startup) أن:

يفحص وجود مستخدم admin

إذا لم يوجد → ينشئه تلقائيًا بكلمة المرور أعلاه

يعطل هذا المسار بمجرد تفعيل AUTH_ENABLED=true + RBAC_ENABLED=true

🧩 6. تهيئة إعدادات النظام

يجب أن يكون هناك إدخال أولي تلقائي (seed) أو يدوي في الجداول التالية:

roles: (admin, analyst, viewer)

permissions: (اختياري، إذا كان النظام يستخدم RBAC دقيق)

schema_access_policies: سياسة افتراضية للتحكم في الوصول

feature_toggles: الإعدادات القابلة للتبديل من الواجهة الأمامية

📑 7. تهيئة التوكن والمفاتيح
JWT_SECRET_KEY=<generated-random>
AUTH_ENABLED=true
RBAC_ENABLED=true


يجب إنشاء هذا السر يدويًا أو عبر Vault

لا يُخزن داخل ملفات الكود أبدًا

📊 8. تهيئة سجلات التدقيق والتتبع (Audit / Telemetry)
ENABLE_AUDIT_LOGGING=true
ENABLE_OTEL=true
OTEL_EXPORTER_OTLP_ENDPOINT=<otel-collector-endpoint>


هل ترغب بسكريبت جاهز لتهيئة الجداول الأساسية (users, roles, admin user) تلقائيًا؟

نعم وانشاء المستخدم الافتراضي

ممتاز. إليك سكريبت Python كامل باستخدام SQLAlchemy، يقوم بـ:

إنشاء الجداول (إن لم تكن موجودة).

إدخال الأدوار الأساسية (admin, analyst, viewer) إن لم تكن موجودة.

إنشاء مستخدم إداري افتراضي بكلمة مرور مأخوذة من المتغير البيئي ADMIN_INITIAL_PASSWORD.

🐍 bootstrap_admin.py
import os
import hashlib
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.models import User, Role, UserRole  # افترض أن هذه النماذج موجودة

# -----------------------
# 1. إعداد الجداول
# -----------------------
def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables ensured.")

# -----------------------
# 2. إدخال الأدوار الأساسية
# -----------------------
def seed_roles(session: Session):
    roles = ["admin", "analyst", "viewer"]
    for role_name in roles:
        exists = session.query(Role).filter_by(name=role_name).first()
        if not exists:
            session.add(Role(name=role_name))
            print(f"🔁 Role created: {role_name}")
    session.commit()

# -----------------------
# 3. إنشاء المستخدم الإداري
# -----------------------
def create_admin_user(session: Session):
    admin_email = "admin@easydata.local"
    admin_password = os.getenv("ADMIN_INITIAL_PASSWORD")

    if not admin_password:
        raise RuntimeError("❌ ADMIN_INITIAL_PASSWORD is not set in environment variables.")

    existing_admin = session.query(User).filter_by(email=admin_email).first()
    if existing_admin:
        print("ℹ️ Admin user already exists. Skipping.")
        return

    # استخدم خوارزمية تجزئة بسيطة (يمكنك استبدالها بـ passlib لاحقًا)
    hashed_password = hashlib.sha256(admin_password.encode()).hexdigest()

    admin_user = User(email=admin_email, hashed_password=hashed_password, is_active=True)
    session.add(admin_user)
    session.flush()  # للحصول على ID

    # ربط المستخدم بدور "admin"
    admin_role = session.query(Role).filter_by(name="admin").first()
    session.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))

    session.commit()
    print("✅ Admin user created.")

# -----------------------
# Entry point
# -----------------------
if __name__ == "__main__":
    create_tables()
    db = SessionLocal()
    try:
        seed_roles(db)
        create_admin_user(db)
    finally:
        db.close()

✅ التعليمات للتشغيل:

تأكد من تفعيل بيئة البيئة:

export ADMIN_INITIAL_PASSWORD="StrongAdmin#123"


ثم شغّل السكريبت:

python bootstrap_admin.py


هل ترغب أن أعدل السكريبت ليستخدم passlib للتجزئة بدل sha256؟

نعم

رائع. إليك النسخة المعدلة من السكريبت باستخدام مكتبة passlib (التي توفّر تجزئة آمنة باستخدام bcrypt) بدلًا من sha256:

📦 أولًا: تثبيت المكتبة
pip install passlib[bcrypt]


أو مع Poetry:

poetry add passlib[bcrypt]

🐍 bootstrap_admin.py (نسخة آمنة باستخدام bcrypt)
import os
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.core.database import Base, engine, SessionLocal
from app.models import User, Role, UserRole

# ⚙️ إعداد أداة التجزئة
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables ensured.")

def seed_roles(session: Session):
    roles = ["admin", "analyst", "viewer"]
    for role_name in roles:
        exists = session.query(Role).filter_by(name=role_name).first()
        if not exists:
            session.add(Role(name=role_name))
            print(f"🔁 Role created: {role_name}")
    session.commit()

def create_admin_user(session: Session):
    admin_email = "admin@easydata.local"
    admin_password = os.getenv("ADMIN_INITIAL_PASSWORD")

    if not admin_password:
        raise RuntimeError("❌ ADMIN_INITIAL_PASSWORD is not set in environment variables.")

    existing_admin = session.query(User).filter_by(email=admin_email).first()
    if existing_admin:
        print("ℹ️ Admin user already exists. Skipping.")
        return

    # ✅ تجزئة آمنة بكلمة مرور
    hashed_password = pwd_context.hash(admin_password)

    admin_user = User(email=admin_email, hashed_password=hashed_password, is_active=True)
    session.add(admin_user)
    session.flush()

    admin_role = session.query(Role).filter_by(name="admin").first()
    session.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))

    session.commit()
    print("✅ Admin user created.")

if __name__ == "__main__":
    create_tables()
    db = SessionLocal()
    try:
        seed_roles(db)
        create_admin_user(db)
    finally:
        db.close()

🔐 نصائح إضافية:

تأكد أن حقل hashed_password في جدول User طويل بما يكفي (يفضل VARCHAR(128) أو أكثر).

استخدم نفس pwd_context.verify(...) في منطق التحقق من كلمة المرور عند تسجيل الدخول.

هل تحتاج سكريبتًا موازيًا لتهيئة البيانات في واجهات الإدارة (مثل feature toggles أو السياسات الافتراضية)؟

نعم

ممتاز. إليك سكريبت تهيئة إضافي يقوم بتهيئة البيانات الإدارية الأساسية في قاعدة البيانات:

🐍 seed_admin_data.py
💡 المهام التي ينفذها:

إنشاء سياسة وصول افتراضية (SchemaAccessPolicy)

تهيئة إعدادات الميزات (FeatureToggles) القابلة للتبديل من الواجهة الأمامية

ضمان وجود إدخال مبدئي في policy_versions

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import SchemaAccessPolicy, FeatureToggle, PolicyVersion
from datetime import datetime

def seed_policy(session: Session):
    exists = session.query(SchemaAccessPolicy).filter_by(name="default_policy").first()
    if not exists:
        policy = SchemaAccessPolicy(
            name="default_policy",
            status="active",
            created_at=datetime.utcnow(),
            enforced_globally=True,
            description="السياسة الافتراضية لجميع المستخدمين"
        )
        session.add(policy)
        print("✅ Default SchemaAccessPolicy created.")
    else:
        print("ℹ️ Default SchemaAccessPolicy already exists.")

def seed_policy_version(session: Session):
    exists = session.query(PolicyVersion).filter_by(version_name="v1-initial").first()
    if not exists:
        version = PolicyVersion(
            version_name="v1-initial",
            description="إصدار السياسات الأولي",
            created_at=datetime.utcnow(),
            activated_by="system"
        )
        session.add(version)
        print("✅ Initial PolicyVersion created.")
    else:
        print("ℹ️ PolicyVersion already exists.")

def seed_feature_toggles(session: Session):
    toggles = {
        "ENABLE_TRAINING_PILOT": True,
        "ENABLE_AUDIT_LOGGING": True,
        "RBAC_ENABLED": True,
        "AUTH_ENABLED": True
    }
    for key, value in toggles.items():
        existing = session.query(FeatureToggle).filter_by(name=key).first()
        if not existing:
            session.add(FeatureToggle(name=key, enabled=value))
            print(f"✅ FeatureToggle created: {key} = {value}")
        else:
            print(f"ℹ️ FeatureToggle already exists: {key}")

    session.commit()

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_policy(db)
        seed_policy_version(db)
        seed_feature_toggles(db)
        db.commit()
    finally:
        db.close()

🧾 ملاحظات تنفيذية

تأكد من أن النماذج التالية موجودة ومتصلة بالـ ORM:

SchemaAccessPolicy

PolicyVersion

FeatureToggle

استخدم هذا السكريبت بعد تهيئة الجداول (مثلًا بعد تشغيل Alembic أو create_all)

لا تعيد تشغيل السكريبت دون التحقق، لأنه لا يحذف الإدخالات السابقة بل يتخطاها

هل ترغب أن أدمج السكريبتين (bootstrap_admin.py و seed_admin_data.py) في سكريبت موحد؟

نعنم

رائع. إليك سكريبت موحد باسم initialize_fortress.py يقوم بما يلي:

✅ المهام:

إنشاء الجداول إن لم تكن موجودة.

إدخال الأدوار الأساسية.

إنشاء مستخدم إداري افتراضي باستخدام ADMIN_INITIAL_PASSWORD.

إدخال السياسة الافتراضية SchemaAccessPolicy.

إنشاء أول إصدار سياسة PolicyVersion.

تهيئة ميزات النظام (FeatureToggles) الافتراضية.

🐍 initialize_fortress.py
import os
from datetime import datetime
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.core.database import Base, engine, SessionLocal
from app.models import (
    User, Role, UserRole,
    SchemaAccessPolicy, PolicyVersion, FeatureToggle
)

# إعداد أداة التجزئة الآمنة
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables ensured.")

def seed_roles(session: Session):
    roles = ["admin", "analyst", "viewer"]
    for role_name in roles:
        if not session.query(Role).filter_by(name=role_name).first():
            session.add(Role(name=role_name))
            print(f"🔁 Role created: {role_name}")
    session.commit()

def create_admin_user(session: Session):
    admin_email = "admin@easydata.local"
    admin_password = os.getenv("ADMIN_INITIAL_PASSWORD")

    if not admin_password:
        raise RuntimeError("❌ ADMIN_INITIAL_PASSWORD is not set.")

    if session.query(User).filter_by(email=admin_email).first():
        print("ℹ️ Admin user already exists. Skipping.")
        return

    hashed_password = pwd_context.hash(admin_password)
    admin_user = User(email=admin_email, hashed_password=hashed_password, is_active=True)
    session.add(admin_user)
    session.flush()

    admin_role = session.query(Role).filter_by(name="admin").first()
    session.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))

    session.commit()
    print("✅ Admin user created.")

def seed_policy(session: Session):
    if not session.query(SchemaAccessPolicy).filter_by(name="default_policy").first():
        policy = SchemaAccessPolicy(
            name="default_policy",
            status="active",
            created_at=datetime.utcnow(),
            enforced_globally=True,
            description="السياسة الافتراضية لجميع المستخدمين"
        )
        session.add(policy)
        print("✅ Default SchemaAccessPolicy created.")

def seed_policy_version(session: Session):
    if not session.query(PolicyVersion).filter_by(version_name="v1-initial").first():
        version = PolicyVersion(
            version_name="v1-initial",
            description="إصدار السياسات الأولي",
            created_at=datetime.utcnow(),
            activated_by="system"
        )
        session.add(version)
        print("✅ Initial PolicyVersion created.")

def seed_feature_toggles(session: Session):
    toggles = {
        "ENABLE_TRAINING_PILOT": True,
        "ENABLE_AUDIT_LOGGING": True,
        "RBAC_ENABLED": True,
        "AUTH_ENABLED": True
    }
    for key, value in toggles.items():
        if not session.query(FeatureToggle).filter_by(name=key).first():
            session.add(FeatureToggle(name=key, enabled=value))
            print(f"✅ FeatureToggle created: {key} = {value}")
    session.commit()

if __name__ == "__main__":
    create_tables()
    db = SessionLocal()
    try:
        seed_roles(db)
        create_admin_user(db)
        seed_policy(db)
        seed_policy_version(db)
        seed_feature_toggles(db)
        db.commit()
        print("🎉 EasyData Fortress initialized successfully.")
    finally:
        db.close()

📦 التشغيل:
export ADMIN_INITIAL_PASSWORD="StrongAdmin#123"
python initialize_fortress.py


هل ترغب أن أجهز ملف Makefile أو سكربت bash لتشغيل هذه التهيئة تلقائيًا؟