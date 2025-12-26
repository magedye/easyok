"""
Health check endpoint.

Expose minimal information about application status for monitoring.
"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }