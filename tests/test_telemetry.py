import asyncio

from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, InMemorySpanExporter
from opentelemetry import trace

from app.services.orchestration_service import OrchestrationService
from app.core.exceptions import InvalidQueryError


class DummyArabicEngine:
    def __init__(self, tracer):
        self.tracer = tracer

    def _is_arabic(self, text: str) -> bool:
        return True

    def process(self, question: str):
        with self.tracer.start_as_current_span(
            "arabic.preprocess",
            attributes={
                "language": "ar",
                "normalization.applied": True,
                "segmentation.applied": True,
                "morphology.applied": True,
                "embedding.model": "camelbert-da",
            },
        ):
            return {
                "original_query": question,
                "normalized_query": question,
                "segmented_query": question,
                "final_query": question,
            }


async def _prepare_with_mocks(spans):
    provider = TracerProvider()
    exporter = InMemorySpanExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    svc = OrchestrationService()
    tracer = trace.get_tracer(__name__)
    # Patch dependencies to avoid external calls
    svc.arabic_engine = DummyArabicEngine(tracer)
    svc.vanna_service.generate_sql = asyncio.coroutine(lambda q: "SELECT 1 FROM DUAL")
    svc.vanna_service.inject_rls_filters = lambda sql, scope: sql
    svc.policy_service.get_active = lambda: type(
        "P", (),
        {
            "allowed_tables": [],
            "allowed_columns": {},
            "denied_tables": [],
            "excluded_tables": [],
            "excluded_columns": {},
            "schema_name": "schema_v1",
            "version": 1,
        },
    )()
    svc.cache_service.enabled = True
    svc.cache_service.lookup = lambda **kwargs: (
        False,
        None,
        0.0,
        "miss",
    )
    svc.sql_guard.validate_and_normalise = lambda sql, policy=None: sql

    try:
        await svc.prepare(question="اختبار", user_context={"role": "admin", "user_id": "u1"})
    except InvalidQueryError:
        pass

    spans.extend(exporter.get_finished_spans())


def test_mandatory_spans_present():
    spans = []
    asyncio.get_event_loop().run_until_complete(_prepare_with_mocks(spans))
    names = {s.name for s in spans}
    assert "arabic.preprocess" in names
    assert "sql.validate" in names
    assert "sql.generate" in names
    assert "semantic_cache.lookup" in names
