"""
Common constants used across the application.

These constants define capability levels and other shared enumerations.
Adjust values as needed to suit your domain.
"""

from enum import IntEnum


class CapabilityLevel(IntEnum):
    """Levels of agent capability based on number of validated training items."""

    BASIC = 1
    LEARNING = 2
    CAPABLE = 3
    ADVANCED = 4
    EXPERT = 5