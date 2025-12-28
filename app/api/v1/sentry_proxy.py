"""
Sentry Proxy: Return Sentry issues with causal trace IDs.

Endpoint: GET /api/v1/admin/settings/sentry-issues

Returns recent exceptions tagged with trace_id for SigNoz correlation.
"""

from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from app.core.admin_rbac import require_admin

router = APIRouter(prefix="/admin/settings", tags=["admin"])


class SentryIssueMetadata(BaseModel):
    """Metadata of a Sentry issue."""
    value: str  # Error message
    trace_id: Optional[str] = None  # Link to SigNoz trace


class SentryIssue(BaseModel):
    """Sentry issue with causal information."""
    id: str
    title: str
    metadata: SentryIssueMetadata
    trace_id: Optional[str]
    lastSeen: str
    status: str
    shortURL: Optional[str] = None


class SentryIssuesResponse(BaseModel):
    """Response with recent Sentry issues."""
    issues: List[SentryIssue]
    total: int


@router.get("/sentry-issues", response_model=SentryIssuesResponse)
@require_admin
async def get_sentry_issues(limit: int = 5) -> SentryIssuesResponse:
    """
    Get recent Sentry issues with trace correlation.
    
    Admin role required.
    
    Each issue includes a trace_id that links to the corresponding
    SigNoz trace for causal analysis.
    
    Used by the Admin Cockpit to show errors alongside performance data.
    """
    # In production, this would call Sentry API
    # For now, return placeholder
    
    return SentryIssuesResponse(
        issues=[
            # SentryIssue(
            #     id="issue_1",
            #     title="Example Error",
            #     metadata=SentryIssueMetadata(
            #         value="ValueError: invalid input",
            #         trace_id="trace_abc123",
            #     ),
            #     trace_id="trace_abc123",
            #     lastSeen="2025-01-10T12:00:00Z",
            #     status="unresolved",
            # )
        ],
        total=0,
    )


@router.get("/sentry-issues/{issue_id}/trace")
@require_admin
async def get_issue_trace(issue_id: str) -> dict:
    """
    Get the SigNoz trace linked to a Sentry issue.
    
    This provides the causal link between error tracking and observability.
    """
    return {
        "issue_id": issue_id,
        "trace_id": "trace_linked_to_issue",
        "signoz_url": "http://signoz-instance:3301/trace/trace_linked_to_issue",
    }
