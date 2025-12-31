# Vanna OSS Core - الوثيقة الدقيقة
## الوظائف الجوهرية الحقيقية فقط (بدون Agent Framework)

**تاريخ الإعداد:** ديسمبر 24، 2025  
**الإصدار:** Vanna 2.0 OSS Core  
**الملاحظة:** هذه الوثيقة تركز على القدرات الأساسية فقط، بدون طبقة Agent

---

## جدول المحتويات

1. ما هو Vanna OSS Core بالضبط
2. الوظائف الجوهرية الحقيقية (6 وظائف)
3. البنية المعمارية
4. أكواد مجردة لكل وظيفة
5. أمثلة تطبيقية
6. حدود Vanna OSS Core
7. ما لم يكن من Core

---

## 1. ما هو Vanna OSS Core بالضبط

### التعريف

```
Vanna OSS Core = مكتبة Python بسيطة

الهدف: تحويل الأسئلة الطبيعية إلى استعلامات SQL

المكونات: 6 وظائف أساسية فقط
```

### ليس لديها

```
❌ Agent Orchestrator
❌ Tool System
❌ User Management
❌ FastAPI Server مدمج
❌ Auto-training Runtime
❌ Conversation Management
```

### المبدأ البسيط

```python
Vanna OSS Core:
    السؤال (طبيعي)
         ↓
    [معالجة داخلية]
         ↓
    SQL Query
         ↓
    أنت تنفذ الاستعلام
```

---

## 2. الوظائف الجوهرية الحقيقية (6 فقط)

### الوظيفة 1: NL → SQL Generation
### الوظيفة 2: RAG (Retrieval)
### الوظيفة 3: Vector Store (Chroma)
### الوظيفة 4: Training Primitives
### الوظيفة 5: Context-aware SQL
### الوظيفة 6: LLM Abstraction

---

## 3. البنية المعمارية البسيطة

```
┌─────────────────────────────────────────┐
│     Vanna OSS Core Class                │
├─────────────────────────────────────────┤
│  الوظيفة 1: generate_sql()              │
│  الوظيفة 2: get_similar_question()      │
│  الوظيفة 3: add_training_data()         │
│  الوظيفة 4: train_sql()                 │
│  الوظيفة 5: get_context()               │
│  الوظيفة 6: (LLM abstraction محلي)      │
└─────────────────────────────────────────┘
         ↓ (يستخدم)
┌─────────────────────────────────────────┐
│  LLM Service (OpenAI, etc)              │
└─────────────────────────────────────────┘
         ↓ (يستخدم)
┌─────────────────────────────────────────┐
│  Vector Store (ChromaDB فقط)            │
└─────────────────────────────────────────┘
```

---

## 4. أكواد مجردة لكل وظيفة

### الوظيفة 1: NL → SQL Generation

```python
from vanna import Vanna

class VannaCoreNLToSQL:
    """
    الوظيفة الأساسية:
    تحويل السؤال الطبيعي إلى استعلام SQL
    
    المدخلات: السؤال (string)
    المخرجات: SQL Query (string)
    """
    
    def __init__(self, llm_service, vector_store):
        """
        المعاملات الأساسية فقط:
        - llm_service: خدمة LLM (OpenAI, Gemini, إلخ)
        - vector_store: ChromaDB للتضمينات
        """
        self.llm = llm_service
        self.vector_store = vector_store
        self.context = None
    
    def generate_sql(self, question: str) -> str:
        """
        العملية الأساسية:
        
        1. استرجاع البيانات التدريبية المماثلة (RAG)
        2. بناء السياق
        3. إرسال إلى LLM
        4. الحصول على SQL
        5. إرجاع النتيجة
        """
        # الخطوة 1: استرجاع (RAG)
        similar = self.vector_store.search(question, top_k=5)
        
        # الخطوة 2: بناء السياق
        context = self._build_context(similar)
        
        # الخطوة 3: إرسال إلى LLM
        prompt = self._build_prompt(question, context)
        
        # الخطوة 4: الحصول على الإجابة
        sql = self.llm.generate(prompt)
        
        # الخطوة 5: الإرجاع
        return sql
    
    def _build_context(self, similar_examples: list) -> str:
        """بناء السياق من الأمثلة المماثلة"""
        context = "التدريبات المماثلة:\n"
        for example in similar_examples:
            context += f"Q: {example['question']}\nSQL: {example['sql']}\n"
        return context
    
    def _build_prompt(self, question: str, context: str) -> str:
        """بناء الـ prompt للـ LLM"""
        return f"""
        {context}
        
        السؤال الجديد: {question}
        أرجع SQL فقط بدون شرح.
        """
```

### الوظيفة 2: RAG (Retrieval)

```python
class VannaCoreRAG:
    """
    الوظيفة الثانية:
    استرجاع البيانات التدريبية المماثلة
    
    المدخلات: السؤال + عدد النتائج
    المخرجات: قائمة الأمثلة المماثلة
    """
    
    def __init__(self, vector_store):
        """
        المعاملات الأساسية:
        - vector_store: ChromaDB فقط
        """
        self.vector_store = vector_store
    
    def retrieve_similar(
        self,
        question: str,
        top_k: int = 5
    ) -> list:
        """
        البحث عن الأمثلة المماثلة
        
        العملية:
        1. تحويل السؤال إلى تضمين (embedding)
        2. البحث في ChromaDB
        3. إرجاع أفضل k نتائج
        """
        # الخطوة 1: التضمين (محلي في ChromaDB)
        embeddings = self.vector_store.embed(question)
        
        # الخطوة 2: البحث
        results = self.vector_store.search(
            query_embedding=embeddings,
            top_k=top_k
        )
        
        # الخطوة 3: الإرجاع
        return results
    
    def get_all_training_data(self) -> list:
        """الحصول على جميع بيانات التدريب"""
        return self.vector_store.get_all()
    
    def search_by_similarity(
        self,
        question: str,
        threshold: float = 0.7
    ) -> list:
        """البحث مع حد أدنى للتشابه"""
        results = self.retrieve_similar(question, top_k=100)
        
        # تصفية حسب العتبة
        filtered = [
            r for r in results 
            if r['similarity_score'] >= threshold
        ]
        
        return filtered
```

### الوظيفة 3: Vector Store (ChromaDB)

```python
class VannaCoreVectorStore:
    """
    الوظيفة الثالثة:
    إدارة ChromaDB للتضمينات
    
    ملاحظة: ChromaDB الوحيد المدعوم في Core
    """
    
    def __init__(self, persist_directory: str = None):
        """
        إعداد ChromaDB:
        - محلي (persist_directory)
        - في الذاكرة (بدون persist_directory)
        """
        import chromadb
        
        if persist_directory:
            self.client = chromadb.PersistentClient(
                path=persist_directory
            )
        else:
            self.client = chromadb.EphemeralClient()
        
        self.collection = self.client.get_or_create_collection(
            name="vanna_training",
            metadata={"hnsw:space": "cosine"}
        )
    
    def add(
        self,
        question: str,
        sql: str,
        metadata: dict = None
    ) -> None:
        """
        إضافة مثال تدريبي
        
        ChromaDB يتعامل مع التضمين تلقائياً
        """
        self.collection.add(
            documents=[question],
            metadatas=[{
                "sql": sql,
                **(metadata or {})
            }],
            ids=[f"training_{id(question)}"]
        )
    
    def search(
        self,
        question: str,
        top_k: int = 5
    ) -> list:
        """البحث عن الأمثلة المماثلة"""
        results = self.collection.query(
            query_texts=[question],
            n_results=top_k
        )
        
        # تحويل النتائج إلى تنسيق موحد
        formatted = []
        for i, doc in enumerate(results['documents'][0]):
            formatted.append({
                'question': doc,
                'sql': results['metadatas'][0][i]['sql'],
                'distance': results['distances'][0][i]
            })
        
        return formatted
    
    def get_all(self) -> list:
        """الحصول على جميع البيانات"""
        all_data = self.collection.get()
        
        formatted = []
        for i, doc in enumerate(all_data['documents']):
            formatted.append({
                'question': doc,
                'sql': all_data['metadatas'][i]['sql']
            })
        
        return formatted
    
    def delete(self, question: str) -> None:
        """حذف مثال"""
        self.collection.delete(
            where={"question": question}
        )
    
    def persist(self) -> None:
        """حفظ البيانات على القرص"""
        # ChromaDB يحفظ تلقائياً مع PersistentClient
        pass
```

### الوظيفة 4: Training Primitives

```python
class VannaCoreTraining:
    """
    الوظيفة الرابعة:
    تدريب النموذج ببيانات التدريب
    
    أنواع البيانات:
    1. DDL Statements (مخطط الجداول)
    2. SQL Examples (أمثلة استعلامات)
    3. Documentation (توثيق العمود)
    """
    
    def __init__(self, vector_store):
        """إعداد نظام التدريب"""
        self.vector_store = vector_store
        self.training_data = {
            'ddl': [],
            'sql': [],
            'docs': []
        }
    
    def train_ddl(self, ddl_statement: str) -> None:
        """
        التدريب 1: DDL (مخطط الجداول)
        
        مثال:
        CREATE TABLE customers (
            id INT PRIMARY KEY,
            name VARCHAR(100)
        );
        """
        self.training_data['ddl'].append(ddl_statement)
        
        # لا نضيفه مباشرة للـ vector store
        # DDL يُستخدم كسياق عام
    
    def train_sql(self, question: str, sql: str) -> None:
        """
        التدريب 2: SQL Examples
        
        أهم نوع تدريب!
        يربط السؤال الطبيعي مع SQL
        """
        self.training_data['sql'].append({
            'question': question,
            'sql': sql
        })
        
        # إضافة إلى Vector Store
        self.vector_store.add(question, sql)
    
    def train_documentation(self, doc: str) -> None:
        """
        التدريب 3: Documentation
        
        توثيق الأعمدة والجداول
        """
        self.training_data['docs'].append(doc)
    
    def train_batch(self, sql_pairs: list) -> None:
        """
        تدريب دفعة من الأمثلة
        
        الإدخال: [
            {'question': '...', 'sql': '...'},
            {'question': '...', 'sql': '...'},
            ...
        ]
        """
        for pair in sql_pairs:
            self.train_sql(
                pair['question'],
                pair['sql']
            )
    
    def get_training_data(self) -> dict:
        """الحصول على جميع بيانات التدريب"""
        return self.training_data
    
    def clear_training(self) -> None:
        """مسح البيانات التدريبية"""
        self.training_data = {
            'ddl': [],
            'sql': [],
            'docs': []
        }
```

### الوظيفة 5: Context-aware SQL Generation

```python
class VannaCoreContextAware:
    """
    الوظيفة الخامسة:
    توليد SQL مع السياق
    
    السياق يشمل:
    - الجداول والأعمدة (DDL)
    - الأمثلة المماثلة (RAG)
    - التوثيق
    """
    
    def __init__(self, llm, vector_store, training_data):
        """المعاملات الأساسية"""
        self.llm = llm
        self.vector_store = vector_store
        self.training_data = training_data
    
    def generate_with_context(self, question: str) -> dict:
        """
        توليد SQL مع السياق الكامل
        
        المخرجات:
        {
            'sql': '...',
            'context': {...},
            'similar_examples': [...]
        }
        """
        # جمع السياق
        context = self._gather_context(question)
        
        # بناء الـ prompt
        prompt = self._build_context_prompt(
            question,
            context
        )
        
        # توليد SQL
        sql = self.llm.generate(prompt)
        
        # الإرجاع مع السياق
        return {
            'sql': sql,
            'context': context,
            'similar_examples': context['similar'],
            'ddl_used': context['ddl'],
            'documentation_used': context['docs']
        }
    
    def _gather_context(self, question: str) -> dict:
        """جمع السياق من جميع المصادر"""
        
        # السياق 1: الأمثلة المماثلة (RAG)
        similar = self.vector_store.search(question, top_k=3)
        
        # السياق 2: DDL
        ddl = self.training_data.get('ddl', [])
        
        # السياق 3: التوثيق
        docs = self.training_data.get('docs', [])
        
        return {
            'similar': similar,
            'ddl': ddl,
            'docs': docs
        }
    
    def _build_context_prompt(
        self,
        question: str,
        context: dict
    ) -> str:
        """بناء prompt مع السياق الكامل"""
        prompt = "# مخطط قاعدة البيانات\n"
        
        # إضافة DDL
        for ddl in context['ddl']:
            prompt += f"{ddl}\n\n"
        
        # إضافة التوثيق
        if context['docs']:
            prompt += "# توثيق الأعمدة\n"
            for doc in context['docs']:
                prompt += f"{doc}\n\n"
        
        # إضافة الأمثلة المماثلة
        prompt += "# أمثلة مماثلة\n"
        for ex in context['similar']:
            prompt += f"Q: {ex['question']}\nSQL: {ex['sql']}\n\n"
        
        # السؤال الجديد
        prompt += f"# السؤال الجديد\nQ: {question}\nSQL: "
        
        return prompt
    
    def refine_sql(
        self,
        question: str,
        initial_sql: str,
        error_message: str = None
    ) -> str:
        """تحسين SQL بناءً على الخطأ"""
        
        if error_message:
            refinement_prompt = f"""
            السؤال: {question}
            SQL الأول: {initial_sql}
            الخطأ: {error_message}
            
            أرجع SQL محسّن:
            """
        else:
            refinement_prompt = f"""
            السؤال: {question}
            SQL الأول: {initial_sql}
            
            هل يمكن تحسين هذا SQL؟
            """
        
        refined_sql = self.llm.generate(refinement_prompt)
        return refined_sql
```

### الوظيفة 6: LLM Abstraction

```python
class VannaCoreLeM:
    """
    الوظيفة السادسة:
    طبقة تجريد LLM
    
    الهدف: دعم LLMs مختلفة بنفس الواجهة
    """
    
    def __init__(self):
        """واجهة مجردة"""
        pass
    
    def generate(self, prompt: str) -> str:
        """
        واجهة موحدة لجميع LLMs
        
        المدخل: prompt (string)
        المخرج: النص المُوّلّد (string)
        """
        raise NotImplementedError
    
    def embed(self, text: str) -> list:
        """
        تضمين النص (إذا دعمه LLM)
        
        المدخل: نص
        المخرج: قائمة أرقام (embedding vector)
        """
        raise NotImplementedError


class OpenAILLMCore(VannaCoreLeM):
    """تطبيق OpenAI"""
    
    def __init__(self, api_key: str, model: str = "gpt-4"):
        from openai import OpenAI
        
        self.client = OpenAI(api_key=api_key)
        self.model = model
    
    def generate(self, prompt: str) -> str:
        """توليد باستخدام OpenAI"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2048
        )
        
        return response.choices[0].message.content
    
    def embed(self, text: str) -> list:
        """تضمين باستخدام OpenAI"""
        response = self.client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        
        return response.data[0].embedding


class GeminiLLMCore(VannaCoreLeM):
    """تطبيق Google Gemini"""
    
    def __init__(self, api_key: str, model: str = "gemini-1.5-pro"):
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)
        self.embedding_model = "models/embedding-001"
    
    def generate(self, prompt: str) -> str:
        """توليد باستخدام Gemini"""
        response = self.model.generate_content(prompt)
        return response.text
    
    def embed(self, text: str) -> list:
        """تضمين باستخدام Gemini"""
        import google.generativeai as genai
        
        result = genai.embed_content(
            model=self.embedding_model,
            content=text
        )
        
        return result['embedding']


class OllamaLLMCore(VannaCoreLeM):
    """تطبيق Ollama (محلي)"""
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "mistral"):
        import requests
        
        self.base_url = base_url
        self.model = model
        self.requests = requests
    
    def generate(self, prompt: str) -> str:
        """توليد باستخدام Ollama"""
        response = self.requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False
            }
        )
        
        return response.json()['response']
    
    def embed(self, text: str) -> list:
        """تضمين باستخدام Ollama"""
        response = self.requests.post(
            f"{self.base_url}/api/embeddings",
            json={
                "model": self.model,
                "prompt": text
            }
        )
        
        return response.json()['embedding']
```

---

## 5. أمثلة تطبيقية

### مثال 1: تطبيق بسيط (الأساسي)

```python
# 1. الإعداد
from vanna.core import VannaCore
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.chromadb import ChromaAgentMemory

# 2. إنشاء مثيلات
llm = OpenAILlmService(api_key="sk-...", model="gpt-4")
vector_store = ChromaAgentMemory(persist_directory="./chroma")

# 3. إنشاء Vanna Core
vanna = VannaCore(
    llm_service=llm,
    vector_store=vector_store
)

# 4. التدريب
vanna.train_sql(
    question="اعرض أفضل 10 عملاء",
    sql="SELECT * FROM customers ORDER BY sales DESC LIMIT 10"
)

vanna.train_sql(
    question="كم عدد الطلبات لكل عميل",
    sql="SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id"
)

# 5. توليد SQL
question = "اعرض الطلبات مرتبة حسب التاريخ"
sql = vanna.generate_sql(question)

print(f"السؤال: {question}")
print(f"SQL: {sql}")

# 6. تنفيذ (أنت تفعل هذا!)
import psycopg2

conn = psycopg2.connect("dbname=mydb user=postgres")
cursor = conn.cursor()
cursor.execute(sql)
results = cursor.fetchall()

print(f"النتائج: {results}")
```

### مثال 2: مع السياق الكامل

```python
# التدريب مع DDL و Documentation
vanna.train_ddl("""
    CREATE TABLE customers (
        id INT PRIMARY KEY,
        name VARCHAR(100),
        country VARCHAR(50),
        total_spent DECIMAL(10, 2)
    );
    
    CREATE TABLE orders (
        id INT PRIMARY KEY,
        customer_id INT,
        amount DECIMAL(10, 2),
        order_date DATE
    );
""")

vanna.train_documentation("""
    - total_spent: إجمالي ما أنفقه العميل
    - order_date: تاريخ الطلب
    - country: دولة العميل
""")

# التدريب مع أمثلة
vanna.train_sql(
    question="اعرض العملاء من السعودية",
    sql="SELECT * FROM customers WHERE country = 'SA'"
)

vanna.train_sql(
    question="اعرض أعلى 5 عملاء إنفاقاً",
    sql="SELECT * FROM customers ORDER BY total_spent DESC LIMIT 5"
)

# توليد مع السياق
result = vanna.generate_with_context(
    "اعرض العملاء من السعودية مع إجمالي طلباتهم"
)

print(f"SQL: {result['sql']}")
print(f"السياق المستخدم: {result['context']}")
```

### مثال 3: مع Refinement

```python
# توليد أول
sql_v1 = vanna.generate_sql(
    "اعرض متوسط قيمة الطلب حسب الدولة"
)

# تنفيذ واختبار
try:
    cursor.execute(sql_v1)
    results = cursor.fetchall()
except Exception as e:
    # في حالة الخطأ، تحسين SQL
    sql_v2 = vanna.refine_sql(
        question="اعرض متوسط قيمة الطلب حسب الدولة",
        initial_sql=sql_v1,
        error_message=str(e)
    )
    
    # محاولة مرة أخرى
    cursor.execute(sql_v2)
    results = cursor.fetchall()
```

### مثال 4: RAG فقط

```python
# الحصول على الأمثلة المماثلة
similar = vanna.retrieve_similar(
    question="أعلى العملاء المنفقين",
    top_k=5
)

print("الأمثلة المماثلة:")
for ex in similar:
    print(f"  Q: {ex['question']}")
    print(f"  SQL: {ex['sql']}")
    print(f"  التشابه: {ex['distance']}")
```

---

## 6. حدود Vanna OSS Core

### ما يمكنه فعله

✅ توليد SQL من الأسئلة الطبيعية
✅ RAG (استرجاع الأمثلة المماثلة)
✅ تخزين البيانات التدريبية (ChromaDB)
✅ دعم LLMs مختلفة
✅ توليد مع السياق
✅ تحسين SQL

### ما لا يمكنه فعله

❌ تنفيذ استعلامات (أنت تفعل هذا)
❌ إدارة المستخدمين
❌ التحقق من الأذونات
❌ توفير واجهة ويب
❌ إدارة المحادثات
❌ أتمتة التدريب
❌ عرض النتائج
❌ رسم البيانات

---

## 7. الفرق بين Vanna OSS Core و Agent Framework

### Vanna OSS Core (6 وظائف)

```python
vanna = VannaCore(llm=..., vector_store=...)
vanna.train_sql(...)
sql = vanna.generate_sql("...")
```

**بسيط جداً، وظائف أساسية فقط**

### Vanna Agent Framework (أضيفت لاحقاً)

```python
agent = Agent(
    llm_service=...,
    tool_registry=...,
    agent_memory=...,
    # ... 10+ معاملات إضافية
)

async for response in agent.send_message("..."):
    # معالجة معقدة
```

**معقد، orchestration شامل**

---

## 8. السيناريو الحقيقي

### ما قدّمناه في الوثائق السابقة

```python
# هذا NOT Vanna OSS Core
agent = Agent(
    llm_service=llm,
    tool_registry=tool_registry,  # ❌ ليس في Core
    agent_memory=memory,           # ❌ ليس في Core
    config=config,                 # ❌ ليس في Core
)

@app.post("/api/query")
async def query(req):
    async for response in agent.send_message(...):  # ❌ ليس في Core
        pass
```

### ما يجب أن تكون عليه Vanna OSS Core

```python
# هذا Vanna OSS Core فقط
vanna = VannaCore(
    llm_service=llm,      # ✅ في Core
    vector_store=vector   # ✅ في Core
)

vanna.train_sql(q, s)    # ✅ في Core
sql = vanna.generate_sql(question)  # ✅ في Core

# أنت تتعامل مع الباقي
cursor.execute(sql)       # أنت تنفذ
results = cursor.fetchall()  # أنت تتعامل مع النتائج
```

---

## الملخص النهائي

### Vanna OSS Core = 6 وظائف فقط

| # | الوظيفة | الكود | الغرض |
|---|---------|------|-------|
| 1 | NL → SQL | `generate_sql()` | تحويل اللغة الطبيعية |
| 2 | RAG | `retrieve_similar()` | استرجاع الأمثلة |
| 3 | ChromaDB | `add()` / `search()` | تخزين التضمينات |
| 4 | Training | `train_sql()` | تدريب الأمثلة |
| 5 | Context-aware | `generate_with_context()` | توليد مع السياق |
| 6 | LLM abstraction | `OpenAILLMCore()` | دعم LLMs مختلفة |

### **لا شيء أكثر من ذلك**

كل شيء آخر (Agent, Tools, Server, إلخ) هو framework إضافي اختياري.

---

**تم الإعداد:** ديسمبر 24، 2025  
**الحالة:** دقيق وفقط Vanna OSS Core ✅

