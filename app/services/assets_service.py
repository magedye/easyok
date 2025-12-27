"""
Service for managing query assets (saved successful queries).
"""

from __future__ import annotations

import json
from typing import Dict, Any, List

from app.core.db import session_scope
from app.models.internal import AssetQuery


class AssetsService:
    def save_asset(
        self,
        *,
        question: str,
        sql: str,
        assumptions: List[str],
        chart_config: Dict[str, Any],
        semantic_context: Dict[str, Any] | None = None,
        created_by: str | None = None,
    ) -> AssetQuery:
        asset = AssetQuery(
            question=question,
            sql=sql,
            assumptions=json.dumps(assumptions or []),
            chart_config=json.dumps(chart_config or {}),
            semantic_context=json.dumps(semantic_context or {}),
            created_by=created_by,
        )
        with session_scope() as session:
            session.add(asset)
            session.flush()
            session.refresh(asset)
            return asset

    def list_assets(self) -> List[AssetQuery]:
        with session_scope() as session:
            return session.query(AssetQuery).order_by(AssetQuery.created_at.desc()).all()

    def delete_asset(self, asset_id: int) -> None:
        with session_scope() as session:
            asset = session.get(AssetQuery, asset_id)
            if asset:
                session.delete(asset)
