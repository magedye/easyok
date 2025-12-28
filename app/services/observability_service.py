from __future__ import annotations

import time
from statistics import mean
from typing import Dict, Any, List

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover
    psutil = None

from app.core.config import get_settings
from app.core.db import session_scope
from app.models.internal import AuditLog


class ObservabilityService:
    @staticmethod
    def system_health() -> Dict[str, Any]:
        settings = get_settings()
        db_status = "ok"
        try:
            with session_scope() as session:
                session.execute("SELECT 1")
        except Exception as exc:  # pragma: no cover
            db_status = f"error: {exc}"

        chroma_status = "unknown"
        try:
            # Lazy check: path existence for persistent vector store
            chroma_status = "ok" if settings.VECTOR_STORE_PATH else "unknown"
        except Exception:
            chroma_status = "unknown"

        start_time = getattr(settings, "START_TIME", None) or getattr(settings, "_START_TIME", None)
        uptime_val = int(time.time() - start_time) if start_time else 0

        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        redis_url = getattr(settings, "REDIS_URL", None)

        return {
            "status": "healthy" if db_status == "ok" else "degraded",
            "database": "ok" if db_status == "ok" else "error",
            "cache": "ok" if redis_url else "error",
            "postgres": db_status,
            "redis": "ok" if redis_url else "error",
            "chroma": chroma_status,
            "vector_store": chroma_status,
            "uptime": uptime_val,
            "timestamp": timestamp,
            "features": {
                "auth_enabled": settings.AUTH_ENABLED,
                "rbac_enabled": settings.RBAC_ENABLED,
                "stream_protocol": settings.STREAM_PROTOCOL,
            },
        }

    @staticmethod
    def metrics_json() -> Dict[str, Any]:
        agg = ObservabilityService.aggregates()
        cpu = psutil.cpu_percent(interval=0.1) if psutil else 0.0
        mem = psutil.virtual_memory().percent if psutil else 0.0
        disk = psutil.disk_usage("/").percent if psutil else 0.0

        # Map to SystemMetrics contract
        return {
            "averageQueryTime": agg.get("averageQueryTime", 0),
            "successRate": agg.get("successRate", 0),
            "activeQueries": agg.get("activeQueries", 0),
            "queriesPerMinute": agg.get("queriesPerMinute", 0),
            "cpuUsage": cpu,
            "memoryUsage": mem,
            "diskUsage": disk,
            "errorRate": agg.get("errorRate", 0),
            "requestVolumeSeries": [
                {"timestamp": v.get("time"), "count": v.get("count")} for v in agg.get("requestVolume", [])
            ],
            "latencyP95Series": [
                {"timestamp": v.get("time"), "ms": v.get("latency")} for v in agg.get("latencySeries", [])
            ],
            "errorRateSeries": [
                {"timestamp": v.get("time"), "rate": v.get("errorRate")} for v in agg.get("latencySeries", [])
            ],
        }

    @staticmethod
    def aggregates() -> Dict[str, Any]:
        with session_scope() as session:
            logs: List[AuditLog] = (
                session.query(AuditLog)
                .order_by(AuditLog.timestamp.desc())
                .limit(500)
                .all()
            )
        total = len(logs)
        successes = [l for l in logs if (l.status or "").lower() == "success"]
        failures = [l for l in logs if (l.status or "").lower() != "success"]
        exec_times = [l.execution_time_ms for l in logs if l.execution_time_ms is not None]
        p95 = 0
        if exec_times:
            sorted_times = sorted(exec_times)
            idx = int(0.95 * (len(sorted_times) - 1))
            p95 = sorted_times[idx]

        # Request volume buckets (last 60 minutes) using minute timestamp
        buckets: Dict[str, int] = {}
        for log in logs:
            minute = log.timestamp.strftime("%H:%M")
            buckets[minute] = buckets.get(minute, 0) + 1
        request_volume = [{"time": k, "count": v} for k, v in sorted(buckets.items())]

        # Error rate series mimic latencySeries with errorRate
        latency_series = []
        for log in logs:
            latency_series.append(
                {
                    "time": log.timestamp.strftime("%H:%M:%S"),
                    "latency": log.execution_time_ms or 0,
                    "errorRate": 0 if (log.status or "").lower() == "success" else 100,
                }
            )

        return {
            "averageQueryTime": mean(exec_times) if exec_times else 0,
            "successRate": (len(successes) / total * 100) if total else 0,
            "activeQueries": 0,
            "queriesPerMinute": request_volume[-1]["count"] if request_volume else 0,
            "requestVolume": request_volume,
            "latencySeries": latency_series,
            "p95Latency": p95,
            "errorRate": (len(failures) / total * 100) if total else 0,
            "total": total,
        }
