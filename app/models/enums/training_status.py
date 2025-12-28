from enum import Enum


class TrainingStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
