from __future__ import annotations

from typing import List, Dict, Any, Optional
import time

import httpx

from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError


class SentryService:
    """
    Read-only proxy to fetch latest issues from Sentry for the governed control plane.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = "https://sentry.io/api/0"
        self.token = getattr(self.settings, "SENTRY_API_TOKEN", None)
        self.org = getattr(self.settings, "SENTRY_ORG_SLUG", None)
        self.project = getattr(self.settings, "SENTRY_PROJECT_SLUG", None)
        # Circuit breaker state
        self._breaker_failures = 0
        self._breaker_timeout = 30
        self._breaker_max_failures = 3
        self._last_failure_time: Optional[float] = None

    def _headers(self) -> Dict[str, str]:
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}

    def _is_open(self) -> bool:
        if self._breaker_failures >= self._breaker_max_failures:
            if self._last_failure_time is None:
                self._last_failure_time = time.time()
            if time.time() - self._last_failure_time < self._breaker_timeout:
                return True
            self._reset_breaker()
        return False

    def _record_failure(self) -> None:
        self._breaker_failures += 1
        self._last_failure_time = time.time()

    def _reset_breaker(self) -> None:
        self._breaker_failures = 0
        self._last_failure_time = None

    async def fetch_latest_issues(self, limit: int = 5) -> List[Dict[str, Any]]:
        if not (self.token and self.org and self.project):
            return []
        if self._is_open():
            raise ServiceUnavailableError("Sentry proxy temporarily unavailable")
        url = f"{self.base_url}/projects/{self.org}/{self.project}/issues/"
        params = {"limit": limit}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params, headers=self._headers())
                resp.raise_for_status()
                issues = resp.json() or []
                cleaned: List[Dict[str, Any]] = []
                for issue in issues[:limit]:
                    cleaned.append(
                        {
                            "id": issue.get("id"),
                            "title": issue.get("title"),
                            "culprit": issue.get("culprit"),
                            "lastSeen": issue.get("lastSeen"),
                            "firstSeen": issue.get("firstSeen"),
                            "permalink": issue.get("permalink"),
                            "status": issue.get("status"),
                            "userCount": issue.get("userCount"),
                            "count": issue.get("count"),
                            "level": issue.get("level"),
                            "trace_id": (issue.get("metadata") or {}).get("value") or issue.get("id"),
                        }
                    )
                self._reset_breaker()
                return cleaned
        except Exception:
            self._record_failure()
            raise
