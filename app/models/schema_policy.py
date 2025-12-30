from typing import Dict, List, Optional

from pydantic import BaseModel


class SchemaAccessPolicyCreate(BaseModel):
    name: str
    schema_name: Optional[str] = None
    allowed_schemas: Optional[List[str]] = None
    allowed_tables: Optional[List[str]] = None
    allowed_columns: Optional[Dict[str, List[str]]] = None
    excluded_tables: Optional[List[str]] = None
    excluded_columns: Optional[Dict[str, List[str]]] = None
    allow_training: bool = True
    active: bool = True
    notes: Optional[str] = None
