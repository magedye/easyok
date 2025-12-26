"""
Training service stub.

This service will manage the ingestion and approval of training data,
including SQL pairs, documentation, and DDL.  For the MVP it is
mostly a placeholder; implement CRUD operations as needed.
"""

from typing import Dict, Any

class TrainingService:
    def add_training_item(self, question: str, sql: str, metadata: Dict[str, Any]) -> None:
        # TODO: persist training data and add to vector store
        pass