"""
Miscellaneous helper functions.
"""

def safe_int(value, default=0):
    try:
        return int(value)
    except (ValueError, TypeError):
        return default