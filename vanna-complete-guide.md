# Vanna OSS Core - دليل شامل بالأكواد المجردة
## وظائف وإمكانيات كاملة مع التركيز على Oracle, MSSQL, Gemini, Azure, OpenAI, Groq, Ollama, ChromaDB, Qdrant

**تاريخ الإعداد:** ديسمبر 24، 2025  
**الإصدار:** Vanna 2.0 OSS Core  
**اللغة:** عربي/إنجليزي

---

## جدول المحتويات

1. نظرة عامة على Vanna OSS Core
2. وظائف المكونات الأساسية
3. قواعد البيانات المدعومة (Oracle, MSSQL)
4. نماذج اللغة (Gemini, Azure, OpenAI, Groq, Ollama)
5. أنظمة الذاكرة (ChromaDB, Qdrant)
6. أمثلة تطبيقية كاملة
7. أفضل الممارسات والأمان

---

## 1. نظرة عامة على Vanna OSS Core

### ما هي Vanna؟

```
Vanna = LLM + SQL + Database
         |      |      |
      النموذج  الاستعلام  البيانات
```

**المعادلة الأساسية:**

```python
User Question (طبيعي) → LLM → SQL Query → Database → Results (طبيعي)
     "اعرض العملاء"     ↓      ↓          ↓        ↓
                    تحويل  SQL          تنفيذ   عرض
```

### المكونات الرئيسية:

1. **Agent** - محرك التنسيق
2. **LLM Service** - نموذج اللغة
3. **Database Runner** - قاعدة البيانات
4. **Memory/Vector Store** - الذاكرة المتجهة
5. **Tools** - الأدوات المتاحة
6. **Server** - خادم الويب

---

## 2. وظائف المكونات الأساسية

### 2.1 Agent - محرك التنسيق

#### الوظائف الأساسية:

```python
from vanna import Agent
from vanna.core.agent import AgentConfig
from vanna.core.user import User

class VannaAgent:
    """
    وظائف Agent الأساسية:
    
    1. معالجة الأسئلة الطبيعية
    2. استدعاء الأدوات بالترتيب الصحيح
    3. إدارة المحادثات
    4. التحكم بالأذونات والوصول
    5. تسجيل جميع العمليات
    """
    
    # الوظيفة 1: إنشاء Agent
    @staticmethod
    def create_agent(llm_service, tool_registry, memory):
        config = AgentConfig(
            max_tool_iterations=10,        # تكرار الأدوات
            stream_responses=True,         # استجابة مستمرة
            auto_save_conversations=True,  # حفظ تلقائي
            temperature=0.7,               # الإبداعية
            max_tokens=4096,               # الحد الأقصى للكلمات
        )
        
        agent = Agent(
            llm_service=llm_service,
            tool_registry=tool_registry,
            agent_memory=memory,
            config=config
        )
        return agent
    
    # الوظيفة 2: معالجة السؤال
    @staticmethod
    async def process_question(agent, question, user_id="default"):
        """
        معالجة سؤال والحصول على النتيجة
        
        العملية:
        1. فهم السؤال
        2. تحديد الأدوات المطلوبة
        3. استدعاء الأدوات بالتسلسل
        4. جمع النتائج
        5. عرض الإجابة
        """
        user = User(
            id=user_id,
            username=user_id,
            email=f"{user_id}@example.com"
        )
        
        responses = []
        async for ui_component in agent.send_message(
            request_context=None,
            message=question
        ):
            responses.append(str(ui_component))
        
        return "\n".join(responses)
    
    # الوظيفة 3: الحصول على الأدوات المتاحة
    @staticmethod
    async def get_available_tools(agent, user):
        """
        الحصول على الأدوات التي يمكن للمستخدم استخدامها
        بناءً على الأذونات
        """
        tools = await agent.get_available_tools(user)
        return [
            {
                "name": tool.name,
                "description": tool.description
            }
            for tool in tools
        ]
    
    # الوظيفة 4: إدارة المحادثات
    @staticmethod
    def get_conversation(agent, conversation_id):
        """استرجاع محادثة سابقة"""
        if hasattr(agent, 'conversation_store'):
            return agent.conversation_store.get_conversation(conversation_id)
        return None
    
    # الوظيفة 5: التنظيف والحفظ
    @staticmethod
    async def save_and_cleanup(agent):
        """حفظ الذاكرة والتنظيف"""
        if hasattr(agent.agent_memory, 'persist'):
            await agent.agent_memory.persist()
```

### 2.2 Tool System - نظام الأدوات

#### أنواع الأدوات:

```python
from vanna.core.tool import Tool, ToolContext, ToolResult
from pydantic import BaseModel, Field
from typing import Type, List, Any, Optional

class VannaTools:
    """
    الأدوات المتاحة في Vanna:
    
    1. RunSqlTool - تنفيذ استعلامات SQL
    2. VisualizeDataTool - رسم البيانات
    3. File Tools - إدارة الملفات
    4. Custom Tools - أدوات مخصصة
    """
    
    # الأداة 1: تنفيذ SQL
    class RunSqlTool(Tool):
        """أداة تنفيذ الاستعلامات"""
        
        @property
        def name(self) -> str:
            return "run_sql"
        
        @property
        def description(self) -> str:
            return "تنفيذ استعلام SQL على قاعدة البيانات"
        
        async def execute(self, context: ToolContext, args: Any) -> ToolResult:
            """
            التنفيذ:
            1. التحقق من الأمان
            2. تنفيذ الاستعلام
            3. معالجة الأخطاء
            4. إرجاع النتائج
            """
            return ToolResult(
                success=True,
                result_for_llm="النتائج:",
                metadata={"rows": 100}
            )
    
    # الأداة 2: رسم البيانات
    class VisualizeDataTool(Tool):
        """أداة رسم البيانات"""
        
        @property
        def name(self) -> str:
            return "visualize_data"
        
        @property
        def description(self) -> str:
            return "رسم البيانات في شكل رسوم بيانية"
        
        async def execute(self, context: ToolContext, args: Any) -> ToolResult:
            """رسم البيانات"""
            return ToolResult(
                success=True,
                result_for_llm="تم رسم البيانات",
                metadata={"chart_type": "bar"}
            )
    
    # الأداة 3: أداة مخصصة
    class CustomDataAnalysisTool(Tool):
        """أداة تحليل بيانات مخصصة"""
        
        class Args(BaseModel):
            data_source: str = Field(description="مصدر البيانات")
            analysis_type: str = Field(description="نوع التحليل")
            filters: Optional[dict] = Field(default=None, description="المرشحات")
        
        @property
        def name(self) -> str:
            return "analyze_data"
        
        @property
        def description(self) -> str:
            return "تحليل البيانات بشكل متقدم"
        
        @property
        def access_groups(self) -> List[str]:
            return ["analysts", "admin"]  # قيود الوصول
        
        def get_args_schema(self) -> Type[Args]:
            return self.Args
        
        async def execute(self, context: ToolContext, args: Args) -> ToolResult:
            """تنفيذ التحليل"""
            analysis_result = {
                "source": args.data_source,
                "type": args.analysis_type,
                "filters": args.filters,
                "summary": "تحليل مكتمل"
            }
            
            return ToolResult(
                success=True,
                result_for_llm=str(analysis_result),
                metadata={"analysis_type": args.analysis_type}
            )
```

### 2.3 User & Permission Management

```python
from vanna.core.user import User

class UserManagement:
    """إدارة المستخدمين والأذونات"""
    
    # إنشاء مستخدم بدون أذونات
    @staticmethod
    def create_basic_user(user_id: str, email: str) -> User:
        return User(
            id=user_id,
            username=user_id,
            email=email,
            permissions=["read_tables"],
            group_memberships=["users"]
        )
    
    # إنشاء مستخدم مدير
    @staticmethod
    def create_admin_user(user_id: str, email: str) -> User:
        return User(
            id=user_id,
            username=user_id,
            email=email,
            permissions=[
                "read_all",
                "write_all",
                "execute_sql",
                "manage_users",
                "view_logs"
            ],
            group_memberships=["admin"]
        )
    
    # إنشاء مستخدم معين الصلاحيات
    @staticmethod
    def create_custom_user(
        user_id: str,
        email: str,
        permissions: List[str],
        groups: List[str]
    ) -> User:
        return User(
            id=user_id,
            username=user_id,
            email=email,
            permissions=permissions,
            group_memberships=groups,
            metadata={
                "department": "sales",
                "role": "analyst"
            }
        )
```

---

## 3. قواعد البيانات المدعومة

### 3.1 Oracle Database

#### الإعداد والاتصال:

```python
from vanna.integrations.oracle import OracleRunner
import cx_Oracle

class OracleSetup:
    """
    إعداد Oracle مع Vanna
    
    المتطلبات:
    - pip install vanna[oracle]
    - Oracle Instant Client
    - البيانات الاعتماد
    """
    
    # الطريقة 1: باستخدام connection string
    @staticmethod
    def setup_basic():
        """إعداد بسيط"""
        runner = OracleRunner(
            connection_string="oracle+cx_Oracle://user:password@host:1521/database"
        )
        return runner
    
    # الطريقة 2: باستخدام المعاملات المنفصلة
    @staticmethod
    def setup_detailed():
        """إعداد مفصل"""
        runner = OracleRunner(
            host="192.168.1.100",
            port=1521,
            database="ORCL",
            username="admin",
            password="secure_password",
            service_name="ORCL.example.com"
        )
        return runner
    
    # الطريقة 3: باستخدام TNS Names
    @staticmethod
    def setup_with_tns():
        """إعداد باستخدام TNS"""
        runner = OracleRunner(
            dsn="tnsnames://PROD_DB",
            username="admin",
            password="secure_password"
        )
        return runner
    
    # الطريقة 4: اتصال محسّن مع خيارات متقدمة
    @staticmethod
    def setup_advanced():
        """إعداد متقدم مع خيارات الأداء"""
        runner = OracleRunner(
            host="oracle-prod.example.com",
            port=1521,
            database="PROD",
            username="vanna_user",
            password="secure_password",
            # خيارات متقدمة
            charset="UTF8",
            nls_lang="ARABIC_SAUDI ARABIA.AR8MSWIN1256",
            threaded=True,
            use_returning_into=True,
            # connection pooling
            pool_size=10,
            max_overflow=20,
            pool_timeout=30
        )
        return runner


class OracleFeatures:
    """ميزات Oracle الخاصة"""
    
    # الميزة 1: التعامل مع الجداول الكبيرة
    @staticmethod
    def handle_large_tables(runner):
        """التعامل مع الجداول الكبيرة"""
        sql = """
        SELECT 
            column_name,
            data_type,
            nullable,
            data_length,
            data_precision
        FROM user_tab_columns
        WHERE table_name = 'LARGE_TABLE'
        ORDER BY column_id
        """
        return runner.run_sql(sql)
    
    # الميزة 2: استخدام Partitions
    @staticmethod
    def query_partitioned_table(runner):
        """الاستعلام من جداول مقسمة"""
        sql = """
        SELECT 
            partition_name,
            partition_position,
            high_value
        FROM user_tab_partitions
        WHERE table_name = 'ORDERS'
        """
        return runner.run_sql(sql)
    
    # الميزة 3: استخدام Indexes للأداء
    @staticmethod
    def optimize_with_indexes(runner):
        """معلومات الفهارس"""
        sql = """
        SELECT 
            index_name,
            table_name,
            uniqueness,
            status
        FROM user_indexes
        WHERE table_name = 'CUSTOMERS'
        """
        return runner.run_sql(sql)
    
    # الميزة 4: stored procedures
    @staticmethod
    def call_stored_procedure(runner):
        """استدعاء stored procedure"""
        sql = """
        BEGIN
            PKG_SALES.calculate_totals(
                p_month => :month,
                p_year => :year,
                p_result => :result
            );
        END;
        """
        return runner.run_sql(sql, {"month": 12, "year": 2024})
    
    # الميزة 5: Package Functions
    @staticmethod
    def use_package_function(runner):
        """استخدام دالة من package"""
        sql = """
        SELECT 
            customer_id,
            PKG_CUSTOMER.get_total_orders(customer_id) as total_orders,
            PKG_CUSTOMER.get_customer_status(customer_id) as status
        FROM customers
        """
        return runner.run_sql(sql)


class OracleIntegration:
    """تكامل كامل مع Vanna"""
    
    @staticmethod
    def create_full_setup():
        """إعداد كامل Oracle مع Vanna"""
        
        from vanna.integrations.openai import OpenAILlmService
        from vanna.integrations.chromadb import ChromaAgentMemory
        from vanna import Agent, ToolRegistry
        from vanna.tools import RunSqlTool
        from vanna.integrations.local import LocalFileSystem
        
        # 1. إعداد Oracle
        oracle_runner = OracleSetup.setup_advanced()
        
        # 2. إعداد LLM
        llm = OpenAILlmService(model="gpt-4")
        
        # 3. إعداد الذاكرة
        memory = ChromaAgentMemory(persist_directory="./chroma_oracle")
        
        # 4. إعداد الأدوات
        tool_registry = ToolRegistry()
        tool_registry.register_local_tool(
            RunSqlTool(
                sql_runner=oracle_runner,
                file_system=LocalFileSystem()
            ),
            access_groups=[]
        )
        
        # 5. إعداد Agent
        agent = Agent(
            llm_service=llm,
            tool_registry=tool_registry,
            agent_memory=memory
        )
        
        # 6. تدريب الـ Agent مع Oracle
        agent.train(
            ddl="""
            CREATE TABLE customers (
                customer_id NUMBER PRIMARY KEY,
                name VARCHAR2(100),
                email VARCHAR2(100),
                country VARCHAR2(50)
            );
            CREATE TABLE orders (
                order_id NUMBER PRIMARY KEY,
                customer_id NUMBER,
                order_date DATE,
                amount NUMBER(10,2),
                FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
            );
            """
        )
        
        agent.train(
            sql="""
            SELECT 
                c.name,
                COUNT(o.order_id) as total_orders,
                SUM(o.amount) as total_spent
            FROM customers c
            LEFT JOIN orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_id, c.name
            """
        )
        
        return agent, oracle_runner
```

### 3.2 MSSQL (SQL Server)

#### الإعداد والاتصال:

```python
from vanna.integrations.mssql import MSSQLRunner
import pyodbc

class MSSQLSetup:
    """
    إعداد MSSQL مع Vanna
    
    المتطلبات:
    - pip install vanna[mssql]
    - ODBC Driver 17 for SQL Server
    """
    
    # الطريقة 1: باستخدام connection string
    @staticmethod
    def setup_basic():
        """إعداد بسيط"""
        runner = MSSQLRunner(
            connection_string="mssql+pyodbc://user:password@server/database?driver=ODBC Driver 17 for SQL Server"
        )
        return runner
    
    # الطريقة 2: باستخدام المعاملات المنفصلة
    @staticmethod
    def setup_detailed():
        """إعداد مفصل"""
        runner = MSSQLRunner(
            host="sql-server.example.com",
            port=1433,
            database="SalesDB",
            username="sa",
            password="SecureP@ssw0rd",
            driver="ODBC Driver 17 for SQL Server"
        )
        return runner
    
    # الطريقة 3: اتصال محسّن
    @staticmethod
    def setup_advanced():
        """إعداد متقدم مع خيارات الأداء"""
        runner = MSSQLRunner(
            host="mssql-cluster.example.com",
            port=1433,
            database="AnalyticsDB",
            username="data_user",
            password="secure_password",
            # خيارات الأداء
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            # التشفير
            encrypt=True,
            trust_cert=False,
            # خيارات أخرى
            application_name="Vanna",
            timeout=30
        )
        return runner


class MSSQLFeatures:
    """ميزات MSSQL الخاصة"""
    
    # الميزة 1: إجراءات مخزنة
    @staticmethod
    def execute_stored_procedure(runner):
        """تنفيذ stored procedure"""
        sql = """
        EXEC sp_GetCustomerReport
            @StartDate = '2024-01-01',
            @EndDate = '2024-12-31',
            @Country = 'SA'
        """
        return runner.run_sql(sql)
    
    # الميزة 2: Temporary Tables
    @staticmethod
    def use_temp_tables(runner):
        """استخدام temporary tables"""
        sql = """
        CREATE TABLE #TempCustomers (
            CustomerID INT,
            Name NVARCHAR(100),
            TotalOrders INT
        );
        
        INSERT INTO #TempCustomers
        SELECT 
            c.CustomerID,
            c.Name,
            COUNT(o.OrderID) as TotalOrders
        FROM Customers c
        LEFT JOIN Orders o ON c.CustomerID = o.CustomerID
        GROUP BY c.CustomerID, c.Name;
        
        SELECT * FROM #TempCustomers
        WHERE TotalOrders > 5
        ORDER BY TotalOrders DESC;
        """
        return runner.run_sql(sql)
    
    # الميزة 3: CTEs
    @staticmethod
    def use_cte(runner):
        """استخدام Common Table Expressions"""
        sql = """
        WITH CustomerSales AS (
            SELECT 
                c.CustomerID,
                c.Name,
                SUM(o.OrderAmount) as TotalSales,
                COUNT(o.OrderID) as OrderCount
            FROM Customers c
            LEFT JOIN Orders o ON c.CustomerID = o.CustomerID
            GROUP BY c.CustomerID, c.Name
        ),
        RankedCustomers AS (
            SELECT 
                *,
                ROW_NUMBER() OVER (ORDER BY TotalSales DESC) as SalesRank
            FROM CustomerSales
        )
        SELECT * FROM RankedCustomers
        WHERE SalesRank <= 100
        """
        return runner.run_sql(sql)
    
    # الميزة 4: Full-Text Search
    @staticmethod
    def full_text_search(runner):
        """البحث عن النصوص"""
        sql = """
        SELECT 
            ProductID,
            ProductName,
            Description,
            RANK
        FROM FREETEXTTABLE(Products, Description, 'high quality')
        WHERE RANK > 50
        ORDER BY RANK DESC
        """
        return runner.run_sql(sql)
    
    # الميزة 5: Dynamic SQL
    @staticmethod
    def dynamic_sql(runner):
        """SQL ديناميكي"""
        sql = """
        DECLARE @TableName NVARCHAR(100) = 'Customers'
        DECLARE @Query NVARCHAR(MAX)
        
        SET @Query = 'SELECT TOP 100 * FROM ' + @TableName
        EXEC sp_executesql @Query
        """
        return runner.run_sql(sql)


class MSSQLIntegration:
    """تكامل كامل مع Vanna"""
    
    @staticmethod
    def create_full_setup():
        """إعداد كامل MSSQL مع Vanna"""
        
        from vanna.integrations.anthropic import AnthropicLlmService
        from vanna.integrations.chromadb import ChromaAgentMemory
        from vanna import Agent, ToolRegistry
        from vanna.tools import RunSqlTool
        from vanna.integrations.local import LocalFileSystem
        
        # 1. إعداد MSSQL
        mssql_runner = MSSQLSetup.setup_advanced()
        
        # 2. إعداد LLM (Claude)
        llm = AnthropicLlmService(model="claude-sonnet-4-5")
        
        # 3. إعداد الذاكرة
        memory = ChromaAgentMemory(persist_directory="./chroma_mssql")
        
        # 4. إعداد الأدوات
        tool_registry = ToolRegistry()
        tool_registry.register_local_tool(
            RunSqlTool(
                sql_runner=mssql_runner,
                file_system=LocalFileSystem()
            ),
            access_groups=[]
        )
        
        # 5. إعداد Agent
        agent = Agent(
            llm_service=llm,
            tool_registry=tool_registry,
            agent_memory=memory
        )
        
        # 6. تدريب الـ Agent
        agent.train(
            ddl="""
            CREATE TABLE Customers (
                CustomerID INT PRIMARY KEY,
                Name NVARCHAR(100),
                Email NVARCHAR(100),
                Country NVARCHAR(50)
            );
            CREATE TABLE Orders (
                OrderID INT PRIMARY KEY,
                CustomerID INT,
                OrderDate DATETIME,
                Amount DECIMAL(10,2),
                FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
            );
            """
        )
        
        agent.train(
            sql="""
            SELECT 
                c.Name,
                COUNT(o.OrderID) as TotalOrders,
                SUM(o.Amount) as TotalAmount
            FROM Customers c
            LEFT JOIN Orders o ON c.CustomerID = o.CustomerID
            GROUP BY c.CustomerID, c.Name
            """
        )
        
        return agent, mssql_runner
```

---

## 4. نماذج اللغة (LLM Models)

### 4.1 OpenAI (GPT-4)

```python
from vanna.integrations.openai import OpenAILlmService

class OpenAISetup:
    """إعداد OpenAI مع Vanna"""
    
    # الإعداد الأساسي
    @staticmethod
    def setup_gpt4():
        """إعداد GPT-4"""
        llm = OpenAILlmService(
            api_key="sk-...",
            model="gpt-4",
            temperature=0.7,
            max_tokens=4096
        )
        return llm
    
    # إعداد GPT-4o (أحدث نموذج)
    @staticmethod
    def setup_gpt4o():
        """إعداد GPT-4o"""
        llm = OpenAILlmService(
            api_key="sk-...",
            model="gpt-4o",
            temperature=0.5,
            max_tokens=8192,
            top_p=0.95
        )
        return llm
    
    # إعداد متعدد المنظمات
    @staticmethod
    def setup_with_organization():
        """إعداد مع منظمة محددة"""
        llm = OpenAILlmService(
            api_key="sk-...",
            model="gpt-4",
            organization="org-...",
            base_url="https://api.openai.com/v1"
        )
        return llm
    
    # إعداد مع proxy
    @staticmethod
    def setup_with_proxy():
        """إعداد مع proxy"""
        import os
        os.environ['OPENAI_PROXY'] = "http://proxy.company.com:8080"
        
        llm = OpenAILlmService(
            api_key="sk-...",
            model="gpt-4"
        )
        return llm
```

### 4.2 Azure OpenAI

```python
from vanna.integrations.azure import AzureOpenAILlmService

class AzureOpenAISetup:
    """إعداد Azure OpenAI مع Vanna"""
    
    # الإعداد الأساسي
    @staticmethod
    def setup_basic():
        """إعداد بسيط"""
        llm = AzureOpenAILlmService(
            api_key="your-azure-api-key",
            api_version="2024-02-15-preview",
            azure_endpoint="https://your-resource.openai.azure.com",
            deployment_name="gpt-4-deployment"
        )
        return llm
    
    # إعداد متقدم
    @staticmethod
    def setup_advanced():
        """إعداد متقدم"""
        llm = AzureOpenAILlmService(
            api_key="your-azure-api-key",
            api_version="2024-02-15-preview",
            azure_endpoint="https://your-resource.openai.azure.com",
            deployment_name="gpt-4-deployment",
            # خيارات إضافية
            organization="your-org",
            timeout=30,
            max_retries=3
        )
        return llm
```

### 4.3 Google Gemini

```python
from vanna.integrations.gemini import GeminiLlmService

class GeminiSetup:
    """إعداد Google Gemini مع Vanna"""
    
    # إعداد Gemini Pro
    @staticmethod
    def setup_gemini_pro():
        """إعداد Gemini Pro"""
        llm = GeminiLlmService(
            api_key="your-google-api-key",
            model="gemini-pro",
            temperature=0.7,
            max_output_tokens=4096
        )
        return llm
    
    # إعداد Gemini 1.5
    @staticmethod
    def setup_gemini_15():
        """إعداد Gemini 1.5"""
        llm = GeminiLlmService(
            api_key="your-google-api-key",
            model="gemini-1.5-pro",
            temperature=0.7,
            max_output_tokens=8000
        )
        return llm
    
    # إعداد مع Vision
    @staticmethod
    def setup_with_vision():
        """إعداد مع إمكانية الرؤية"""
        llm = GeminiLlmService(
            api_key="your-google-api-key",
            model="gemini-pro-vision",
            temperature=0.7
        )
        return llm
```

### 4.4 Anthropic Claude

```python
from vanna.integrations.anthropic import AnthropicLlmService

class AnthropicSetup:
    """إعداد Anthropic Claude مع Vanna"""
    
    # إعداد Claude Sonnet
    @staticmethod
    def setup_claude_sonnet():
        """إعداد Claude Sonnet"""
        llm = AnthropicLlmService(
            api_key="sk-ant-...",
            model="claude-sonnet-4-5",
            temperature=0.7,
            max_tokens=4096
        )
        return llm
    
    # إعداد Claude Opus (الأقوى)
    @staticmethod
    def setup_claude_opus():
        """إعداد Claude Opus"""
        llm = AnthropicLlmService(
            api_key="sk-ant-...",
            model="claude-opus",
            temperature=0.5,
            max_tokens=8000
        )
        return llm
    
    # إعداد مع batch processing
    @staticmethod
    def setup_with_batch():
        """إعداد مع معالجة دفعات"""
        llm = AnthropicLlmService(
            api_key="sk-ant-...",
            model="claude-sonnet-4-5",
            # يمكن استخدام batch API للتوفير
            use_batch=True
        )
        return llm
```

### 4.5 Groq

```python
from vanna.integrations.groq import GroqLlmService

class GroqSetup:
    """إعداد Groq مع Vanna (أسرع نموذج)"""
    
    # إعداد Llama
    @staticmethod
    def setup_llama():
        """إعداد Llama عبر Groq"""
        llm = GroqLlmService(
            api_key="your-groq-api-key",
            model="llama-3.1-70b-versatile",
            temperature=0.7
        )
        return llm
    
    # إعداد Mixtral
    @staticmethod
    def setup_mixtral():
        """إعداد Mixtral عبر Groq"""
        llm = GroqLlmService(
            api_key="your-groq-api-key",
            model="mixtral-8x7b-32768",
            temperature=0.5
        )
        return llm
    
    # مقارنة السرعة
    @staticmethod
    def groq_is_fastest():
        """
        Groq هو الأسرع:
        - Inference: <100ms
        - Throughput: 500+ tokens/sec
        - مشابه لـ LLaMA 70B في الجودة
        """
        return True
```

### 4.6 Ollama (محلي)

```python
from vanna.integrations.ollama import OllamaLlmService

class OllamaSetup:
    """إعداد Ollama (نماذج محلية)"""
    
    # إعداد محلي
    @staticmethod
    def setup_local():
        """إعداد Ollama محلي"""
        llm = OllamaLlmService(
            base_url="http://localhost:11434",
            model="llama2"
        )
        return llm
    
    # إعداد مع نماذج مختلفة
    @staticmethod
    def setup_with_different_models():
        """إعداد مع نماذج مختلفة"""
        models = {
            "llama2": "الأساسي",
            "neural-chat": "محسّن للحوار",
            "orca-mini": "سريع وصغير",
            "mistral": "متوازن",
            "dolphin-mixtral": "متقدم"
        }
        
        # استخدام Mistral
        llm = OllamaLlmService(
            base_url="http://localhost:11434",
            model="mistral"
        )
        return llm
    
    # إعداد مع تحكم كامل
    @staticmethod
    def setup_advanced():
        """إعداد متقدم"""
        llm = OllamaLlmService(
            base_url="http://localhost:11434",
            model="neural-chat",
            temperature=0.7,
            top_p=0.9,
            top_k=40,
            num_predict=4096
        )
        return llm
    
    # تثبيت الأدوات المطلوبة
    @staticmethod
    def install_ollama():
        """
        خطوات التثبيت:
        
        1. تحميل Ollama:
           https://ollama.ai
        
        2. تشغيل Ollama:
           ollama serve
        
        3. تحميل نموذج:
           ollama pull llama2
           ollama pull mistral
           ollama pull neural-chat
        
        4. التحقق:
           curl http://localhost:11434/api/models
        """
        import subprocess
        import os
        
        # تحميل نموذج
        subprocess.run(["ollama", "pull", "mistral"])
        
        # تشغيل الخادم
        subprocess.Popen(["ollama", "serve"])
```

---

## 5. أنظمة الذاكرة (Memory/Vector Stores)

### 5.1 ChromaDB

```python
from vanna.integrations.chromadb import ChromaAgentMemory

class ChromaDBSetup:
    """إعداد ChromaDB مع Vanna"""
    
    # الإعداد الأساسي (محلي)
    @staticmethod
    def setup_local():
        """إعداد محلي"""
        memory = ChromaAgentMemory(
            persist_directory="./chroma_data",
            collection_name="vanna_memory"
        )
        return memory
    
    # إعداد في الذاكرة
    @staticmethod
    def setup_in_memory():
        """إعداد في الذاكرة (مؤقت)"""
        memory = ChromaAgentMemory(
            persist_directory=None,
            allow_reset=True
        )
        return memory
    
    # إعداد متقدم
    @staticmethod
    def setup_advanced():
        """إعداد متقدم مع خيارات أداء"""
        memory = ChromaAgentMemory(
            persist_directory="./chroma_data",
            collection_name="vanna_memory",
            # خيارات أداء
            metric="cosine",  # نوع المسافة
            hnsw_space="cosine"  # مساحة البحث
        )
        return memory
    
    # العمليات الأساسية
    @staticmethod
    def basic_operations(memory):
        """العمليات الأساسية"""
        
        # 1. حفظ بيانات تدريب
        memory.add(
            question="Show top 10 customers",
            sql="SELECT * FROM customers ORDER BY sales DESC LIMIT 10",
            training_data="DDL: CREATE TABLE customers...",
            run_id="run_123"
        )
        
        # 2. البحث عن تشابه
        results = memory.search(
            question="Show best customers",
            top_k=5
        )
        
        # 3. الحصول على جميع البيانات
        all_data = memory.get_all()
        
        # 4. حذف بيانات
        memory.delete(question="old question")
        
        # 5. حفظ على القرص
        memory.persist()
```

### 5.2 Qdrant

```python
from vanna.integrations.qdrant import QdrantAgentMemory

class QdrantSetup:
    """إعداد Qdrant مع Vanna"""
    
    # الإعداد المحلي
    @staticmethod
    def setup_local():
        """إعداد محلي مع Qdrant"""
        memory = QdrantAgentMemory(
            path="./qdrant_data",
            collection_name="vanna_memory"
        )
        return memory
    
    # الإعداد السحابي
    @staticmethod
    def setup_cloud():
        """إعداد سحابي مع Qdrant"""
        memory = QdrantAgentMemory(
            url="https://your-qdrant-cloud.qdrant.io",
            api_key="your-api-key",
            collection_name="vanna_memory"
        )
        return memory
    
    # إعداد Docker
    @staticmethod
    def setup_docker():
        """إعداد مع Docker"""
        # docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
        
        memory = QdrantAgentMemory(
            url="http://localhost:6333",
            collection_name="vanna_memory"
        )
        return memory
    
    # الإعداد المتقدم
    @staticmethod
    def setup_advanced():
        """إعداد متقدم"""
        memory = QdrantAgentMemory(
            url="http://localhost:6333",
            collection_name="vanna_memory",
            # خيارات الأداء
            prefer_grpc=True,  # استخدام gRPC (أسرع)
            timeout=30,
            # إعدادات المجموعة
            vector_size=1536,  # حجم التضمين
            distance="Cosine"  # نوع المسافة
        )
        return memory
    
    # مزايا Qdrant
    @staticmethod
    def qdrant_advantages():
        """
        مزايا Qdrant مقابل ChromaDB:
        
        ✅ أداء أعلى للبحث (gRPC)
        ✅ قابل للتوسع بشكل أفضل
        ✅ ذاكرة أقل استهلاكاً
        ✅ دعم clustering
        ✅ واجهة إدارة ويب
        ✅ نسخ احتياطية تلقائية
        """
        return True
```

---

## 6. أمثلة تطبيقية كاملة

### مثال 1: تطبيق Oracle + GPT-4 + ChromaDB

```python
import asyncio
from vanna.integrations.oracle import OracleRunner
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.chromadb import ChromaAgentMemory
from vanna import Agent, ToolRegistry
from vanna.tools import RunSqlTool, VisualizeDataTool
from vanna.integrations.local import LocalFileSystem

class OracleGPT4ChatBot:
    """تطبيق كامل: Oracle + GPT-4 + ChromaDB"""
    
    def __init__(self):
        self.setup()
    
    def setup(self):
        """إعداد جميع المكونات"""
        
        # 1. إعداد Oracle
        self.oracle = OracleRunner(
            host="oracle-prod.com",
            port=1521,
            database="PROD",
            username="vanna_user",
            password="secure_pass",
            charset="UTF8"
        )
        
        # 2. إعداد GPT-4
        self.llm = OpenAILlmService(
            api_key="sk-...",
            model="gpt-4"
        )
        
        # 3. إعداد ChromaDB
        self.memory = ChromaAgentMemory(
            persist_directory="./chroma_oracle_gpt4"
        )
        
        # 4. إعداد الأدوات
        self.file_system = LocalFileSystem()
        self.tool_registry = ToolRegistry()
        
        self.tool_registry.register_local_tool(
            RunSqlTool(
                sql_runner=self.oracle,
                file_system=self.file_system
            ),
            access_groups=[]
        )
        
        self.tool_registry.register_local_tool(
            VisualizeDataTool(file_system=self.file_system),
            access_groups=[]
        )
        
        # 5. إعداد Agent
        self.agent = Agent(
            llm_service=self.llm,
            tool_registry=self.tool_registry,
            agent_memory=self.memory
        )
        
        # 6. التدريب
        self._train()
    
    def _train(self):
        """تدريب الـ Agent"""
        
        # تدريب DDL
        self.agent.train(
            ddl="""
            CREATE TABLE CUSTOMERS (
                CUSTOMER_ID NUMBER PRIMARY KEY,
                CUSTOMER_NAME VARCHAR2(100),
                EMAIL VARCHAR2(100),
                COUNTRY VARCHAR2(50),
                CREATED_DATE DATE
            );
            
            CREATE TABLE ORDERS (
                ORDER_ID NUMBER PRIMARY KEY,
                CUSTOMER_ID NUMBER,
                ORDER_DATE DATE,
                AMOUNT NUMBER(10,2),
                STATUS VARCHAR2(20),
                FOREIGN KEY (CUSTOMER_ID) REFERENCES CUSTOMERS(CUSTOMER_ID)
            );
            
            CREATE TABLE ORDER_ITEMS (
                ITEM_ID NUMBER PRIMARY KEY,
                ORDER_ID NUMBER,
                PRODUCT_ID NUMBER,
                QUANTITY NUMBER,
                UNIT_PRICE NUMBER(10,2),
                FOREIGN KEY (ORDER_ID) REFERENCES ORDERS(ORDER_ID)
            );
            """
        )
        
        # تدريب أمثلة SQL
        self.agent.train(
            sql="""
            SELECT 
                c.CUSTOMER_NAME,
                COUNT(o.ORDER_ID) as TOTAL_ORDERS,
                SUM(o.AMOUNT) as TOTAL_SPENT,
                MAX(o.ORDER_DATE) as LAST_ORDER
            FROM CUSTOMERS c
            LEFT JOIN ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
            GROUP BY c.CUSTOMER_ID, c.CUSTOMER_NAME
            ORDER BY TOTAL_SPENT DESC
            """
        )
        
        # تدريب توثيق
        self.agent.train(
            documentation="""
            جداول العملاء والطلبات:
            - CUSTOMERS: معلومات العملاء الأساسية
            - ORDERS: الطلبات مع التاريخ والمبلغ
            - ORDER_ITEMS: تفاصيل العناصر في كل طلب
            
            الاستعلامات الشائعة:
            - أعلى العملاء المنفقين
            - المبيعات حسب الدولة
            - متوسط قيمة الطلب
            """
        )
    
    async def chat(self, question: str, user_id: str = "default"):
        """دالة الحوار"""
        responses = []
        async for response in self.agent.send_message(
            request_context=None,
            message=question
        ):
            responses.append(str(response))
        
        return "\n".join(responses)
    
    async def run_interactive(self):
        """تشغيل تفاعلي"""
        print("🤖 Oracle SQL Chat Bot")
        print("=" * 50)
        
        questions = [
            "اعرض أفضل 10 عملاء من حيث الإنفاق",
            "ما هو إجمالي المبيعات حسب الدولة؟",
            "اعرض الطلبات المعلقة"
        ]
        
        for q in questions:
            print(f"\n❓ {q}")
            result = await self.chat(q)
            print(f"✅ {result}")

# التشغيل
async def main():
    bot = OracleGPT4ChatBot()
    await bot.run_interactive()

if __name__ == "__main__":
    asyncio.run(main())
```

### مثال 2: تطبيق MSSQL + Gemini + Qdrant

```python
import asyncio
from vanna.integrations.mssql import MSSQLRunner
from vanna.integrations.gemini import GeminiLlmService
from vanna.integrations.qdrant import QdrantAgentMemory
from vanna import Agent, ToolRegistry
from vanna.tools import RunSqlTool, VisualizeDataTool
from vanna.integrations.local import LocalFileSystem

class MSSQLGeminiChatBot:
    """تطبيق كامل: MSSQL + Gemini + Qdrant"""
    
    def __init__(self):
        self.setup()
    
    def setup(self):
        """إعداد جميع المكونات"""
        
        # 1. إعداد MSSQL
        self.mssql = MSSQLRunner(
            host="sql-server.company.com",
            port=1433,
            database="AnalyticsDB",
            username="analytics_user",
            password="secure_password",
            driver="ODBC Driver 17 for SQL Server",
            encrypt=True
        )
        
        # 2. إعداد Gemini
        self.llm = GeminiLlmService(
            api_key="your-gemini-api-key",
            model="gemini-1.5-pro"
        )
        
        # 3. إعداد Qdrant (أداء أعلى)
        self.memory = QdrantAgentMemory(
            url="http://localhost:6333",
            collection_name="mssql_gemini",
            prefer_grpc=True
        )
        
        # 4. إعداد الأدوات
        self.file_system = LocalFileSystem()
        self.tool_registry = ToolRegistry()
        
        self.tool_registry.register_local_tool(
            RunSqlTool(
                sql_runner=self.mssql,
                file_system=self.file_system
            ),
            access_groups=[]
        )
        
        self.tool_registry.register_local_tool(
            VisualizeDataTool(file_system=self.file_system),
            access_groups=[]
        )
        
        # 5. إعداد Agent
        self.agent = Agent(
            llm_service=self.llm,
            tool_registry=self.tool_registry,
            agent_memory=self.memory
        )
        
        self._train()
    
    def _train(self):
        """تدريب الـ Agent"""
        
        self.agent.train(
            ddl="""
            CREATE TABLE Customers (
                CustomerID INT PRIMARY KEY,
                Name NVARCHAR(100),
                Email NVARCHAR(100),
                Country NVARCHAR(50)
            );
            
            CREATE TABLE Orders (
                OrderID INT PRIMARY KEY,
                CustomerID INT,
                OrderDate DATETIME,
                TotalAmount DECIMAL(10,2),
                Status NVARCHAR(20),
                FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
            );
            """
        )
        
        self.agent.train(
            sql="""
            WITH CustomerMetrics AS (
                SELECT 
                    c.CustomerID,
                    c.Name,
                    COUNT(o.OrderID) as OrderCount,
                    SUM(o.TotalAmount) as TotalSpent,
                    AVG(o.TotalAmount) as AvgOrder,
                    MAX(o.OrderDate) as LastOrder
                FROM Customers c
                LEFT JOIN Orders o ON c.CustomerID = o.CustomerID
                GROUP BY c.CustomerID, c.Name
            )
            SELECT * FROM CustomerMetrics
            WHERE OrderCount > 0
            ORDER BY TotalSpent DESC
            """
        )
    
    async def chat(self, question: str):
        """دالة الحوار"""
        responses = []
        async for response in self.agent.send_message(
            request_context=None,
            message=question
        ):
            responses.append(str(response))
        
        return "\n".join(responses)

# التشغيل
async def main():
    bot = MSSQLGeminiChatBot()
    result = await bot.chat("اعرض أفضل العملاء")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
```

### مثال 3: تطبيق متعدد قواعد البيانات

```python
import asyncio
from typing import Dict
from vanna import Agent, ToolRegistry
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.chromadb import ChromaAgentMemory
from vanna.tools import RunSqlTool
from vanna.integrations.local import LocalFileSystem

class MultiDatabaseSystem:
    """نظام متعدد قواعد البيانات"""
    
    def __init__(self):
        self.databases: Dict[str, object] = {}
        self.agents: Dict[str, Agent] = {}
        self.setup()
    
    def setup(self):
        """إعداد قواعد بيانات متعددة"""
        
        from vanna.integrations.oracle import OracleRunner
        from vanna.integrations.mssql import MSSQLRunner
        from vanna.integrations.postgres import PostgresRunner
        
        # إضافة Oracle
        self.databases['oracle'] = OracleRunner(
            host="oracle.company.com",
            port=1521,
            database="PROD",
            username="user",
            password="pass"
        )
        
        # إضافة MSSQL
        self.databases['mssql'] = MSSQLRunner(
            host="mssql.company.com",
            port=1433,
            database="AnalyticsDB",
            username="user",
            password="pass",
            driver="ODBC Driver 17 for SQL Server"
        )
        
        # إضافة PostgreSQL
        self.databases['postgres'] = PostgresRunner(
            host="postgres.company.com",
            port=5432,
            database="analytics",
            username="user",
            password="pass"
        )
        
        # إنشاء Agent لكل قاعدة بيانات
        llm = OpenAILlmService(model="gpt-4")
        
        for db_name, runner in self.databases.items():
            memory = ChromaAgentMemory(
                persist_directory=f"./chroma_{db_name}"
            )
            
            tool_registry = ToolRegistry()
            tool_registry.register_local_tool(
                RunSqlTool(
                    sql_runner=runner,
                    file_system=LocalFileSystem()
                ),
                access_groups=[]
            )
            
            agent = Agent(
                llm_service=llm,
                tool_registry=tool_registry,
                agent_memory=memory
            )
            
            self.agents[db_name] = agent
    
    async def query(self, db_name: str, question: str):
        """الاستعلام من قاعدة بيانات محددة"""
        if db_name not in self.agents:
            return f"قاعدة البيانات {db_name} غير متوفرة"
        
        agent = self.agents[db_name]
        responses = []
        async for response in agent.send_message(
            request_context=None,
            message=question
        ):
            responses.append(str(response))
        
        return "\n".join(responses)
    
    async def query_all(self, question: str):
        """الاستعلام من جميع قواعد البيانات"""
        results = {}
        for db_name in self.agents:
            results[db_name] = await self.query(db_name, question)
        return results

# التشغيل
async def main():
    system = MultiDatabaseSystem()
    
    # استعلام من Oracle
    oracle_result = await system.query('oracle', "اعرض العملاء")
    print("Oracle:", oracle_result)
    
    # استعلام من جميع قواعد البيانات
    all_results = await system.query_all("اعرض الإحصائيات")
    print("جميع النتائج:", all_results)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 7. أفضل الممارسات والأمان

### 7.1 أفضل الممارسات

```python
class BestPractices:
    """أفضل الممارسات في استخدام Vanna"""
    
    # 1. إدارة المفاتيح الآمنة
    @staticmethod
    def secure_api_keys():
        """
        ✅ استخدم متغيرات البيئة
        ✅ استخدم .env files
        ✅ لا تضع المفاتيح في الكود
        ✅ استخدم secret managers (AWS Secrets, Azure Key Vault)
        """
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        
        api_key = os.getenv('OPENAI_API_KEY')
        db_password = os.getenv('DB_PASSWORD')
        
        if not api_key or not db_password:
            raise ValueError("المفاتيح غير موجودة في البيئة")
        
        return api_key, db_password
    
    # 2. التحقق من المدخلات
    @staticmethod
    def validate_inputs():
        """التحقق من مدخلات المستخدم"""
        
        def is_safe_question(question: str) -> bool:
            """التحقق من السؤال"""
            # حد أقصى للطول
            if len(question) > 1000:
                return False
            
            # تجنب الأوامر الخطيرة
            dangerous_keywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER']
            if any(kw in question.upper() for kw in dangerous_keywords):
                return False
            
            return True
        
        question = "اعرض العملاء"
        if is_safe_question(question):
            print("✅ سؤال آمن")
        else:
            print("❌ سؤال غير آمن")
    
    # 3. logging والتدقيق
    @staticmethod
    def setup_logging():
        """إعداد التسجيل والتدقيق"""
        
        import logging
        import json
        from datetime import datetime
        
        # إعداد logger
        logger = logging.getLogger('vanna_audit')
        handler = logging.FileHandler('vanna_audit.log')
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        # تسجيل استعلام
        def log_query(user_id: str, question: str, sql: str, status: str):
            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'user_id': user_id,
                'question': question,
                'sql': sql,
                'status': status
            }
            logger.info(json.dumps(log_entry))
        
        return log_query
    
    # 4. تحديد الموارد
    @staticmethod
    def limit_resources():
        """تحديد موارد الاستعلام"""
        
        query_limits = {
            'max_rows': 10000,
            'max_execution_time': 30,  # ثواني
            'max_memory': 1024,  # MB
            'max_concurrent': 5
        }
        
        return query_limits
    
    # 5. التخزين المؤقت
    @staticmethod
    def setup_caching():
        """إعداد التخزين المؤقت"""
        
        from functools import lru_cache
        import hashlib
        
        @lru_cache(maxsize=1000)
        def cached_sql_generation(question: str) -> str:
            """تخزين مؤقت لـ SQL المُوّلّد"""
            # التوليد هنا
            pass
        
        @lru_cache(maxsize=500)
        def cached_query_results(sql_hash: str):
            """تخزين مؤقت للنتائج"""
            pass
        
        return cached_sql_generation, cached_query_results
```

### 7.2 الأمان

```python
class SecurityBestPractices:
    """ممارسات الأمان"""
    
    # 1. Role-Based Access Control (RBAC)
    @staticmethod
    def setup_rbac():
        """إعداد التحكم في الوصول"""
        
        from vanna.core.user import User
        
        roles = {
            'admin': {
                'permissions': ['read_all', 'write_all', 'delete_all', 'manage_users'],
                'tables': ['*']
            },
            'analyst': {
                'permissions': ['read_all', 'write_own'],
                'tables': ['*']
            },
            'viewer': {
                'permissions': ['read_own'],
                'tables': ['customers', 'orders', 'products']
            }
        }
        
        # إنشاء مستخدم مع دور
        user = User(
            id="analyst_1",
            username="john",
            email="john@example.com",
            permissions=roles['analyst']['permissions'],
            group_memberships=['analysts']
        )
        
        return user
    
    # 2. SQL Injection Prevention
    @staticmethod
    def prevent_sql_injection():
        """منع SQL Injection"""
        
        def sanitize_input(user_input: str) -> str:
            """تنظيف المدخلات"""
            # حذف الأحرف الخطيرة
            dangerous_chars = ["'", '"', ";", "--", "/*", "*/"]
            for char in dangerous_chars:
                user_input = user_input.replace(char, "")
            
            return user_input
        
        # الطريقة الأفضل: استخدام parameterized queries
        # (تتعامل معها Vanna تلقائياً)
        
        return sanitize_input
    
    # 3. Encryption
    @staticmethod
    def setup_encryption():
        """تشفير البيانات"""
        
        from cryptography.fernet import Fernet
        
        # إنشاء مفتاح تشفير
        key = Fernet.generate_key()
        cipher = Fernet(key)
        
        # تشفير كلمة مرور
        password = "my_secure_password"
        encrypted = cipher.encrypt(password.encode())
        
        # فك التشفير
        decrypted = cipher.decrypt(encrypted).decode()
        
        return cipher
    
    # 4. HTTPS والـ SSL
    @staticmethod
    def setup_https():
        """إعداد HTTPS"""
        
        # في FastAPI
        ssl_config = {
            'ssl_keyfile': '/path/to/key.pem',
            'ssl_certfile': '/path/to/cert.pem',
            'ssl_version': 'TLSv1_2'
        }
        
        # أو استخدام reverse proxy (Nginx)
        nginx_config = """
        server {
            listen 443 ssl;
            ssl_certificate /etc/ssl/certs/cert.pem;
            ssl_certificate_key /etc/ssl/private/key.pem;
            
            location / {
                proxy_pass http://localhost:8000;
            }
        }
        """
        
        return ssl_config
    
    # 5. Rate Limiting
    @staticmethod
    def setup_rate_limiting():
        """تحديد معدل الطلبات"""
        
        from slowapi import Limiter
        from slowapi.util import get_remote_address
        
        limiter = Limiter(key_func=get_remote_address)
        
        # تطبيق على الـ endpoint
        # @limiter.limit("5/minute")
        # async def query_endpoint():
        #     pass
        
        return limiter
```

---

## 8. مقارنة سريعة

### مقارنة النماذج

| النموذج | السرعة | الجودة | التكلفة | الخصوصية |
|---------|--------|--------|---------|---------|
| GPT-4 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $$$ | تطبيق OpenAI |
| GPT-4o | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $$$ | تطبيق OpenAI |
| Claude Opus | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $$$ | تطبيق Anthropic |
| Claude Sonnet | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$ | تطبيق Anthropic |
| Gemini 1.5 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $ | تطبيق Google |
| Groq Llama | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Free | محلي |
| Ollama Mistral | ⭐⭐⭐⭐ | ⭐⭐⭐ | Free | محلي تماماً |

### مقارنة قواعس البيانات

| القاعدة | الأداء | المرونة | التكلفة | الدعم |
|---------|--------|---------|---------|--------|
| Oracle | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $$$ | ممتاز |
| MSSQL | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$ | ممتاز |
| PostgreSQL | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Free | جيد |

### مقارنة الذاكرة

| النظام | السرعة | المرونة | المتطلبات |
|--------|--------|---------|-----------|
| ChromaDB | ⭐⭐⭐ | ⭐⭐⭐ | محلي |
| Qdrant | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Docker |
| Pinecone | ⭐⭐⭐ | ⭐⭐⭐⭐ | سحابي |

---

## الملخص النهائي

**Vanna OSS Core يوفر:**

✅ **نماذج متعددة:**
- OpenAI, Azure, Gemini, Claude, Groq, Ollama

✅ **قواعس بيانات:**
- Oracle, MSSQL, PostgreSQL, MySQL, SQLite, Snowflake, BigQuery, DuckDB

✅ **أنظمة ذاكرة:**
- ChromaDB, Qdrant, Pinecone

✅ **خوادم:**
- FastAPI, Flask

✅ **أمان وتدقيق:**
- RBAC, Logging, Encryption, Rate Limiting

✅ **أداء عالي:**
- Caching, Optimization, Parallel Processing

---

**تم الإعداد:** ديسمبر 24، 2025  
**الحالة:** شامل وجاهز للإنتاج ✅

