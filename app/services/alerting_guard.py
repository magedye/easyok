from __future__ import annotations

import logging
import os
from typing import Dict, Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def initialize_alerting() -> Dict[str, Any]:
    """
    Enforce ENABLE_SIGNOZ_ALERTS at runtime.

    When disabled, no alert rules should be loaded or exported.
    This function sets an explicit environment flag that downstream
    provisioning code can honor.
    """
    settings = get_settings()
    if not settings.ENABLE_SIGNOZ_ALERTS:
        os.environ["SIGNOZ_ALERTS_ENABLED"] = "0"
        logger.info("SigNoz alerts disabled: ENABLE_SIGNOZ_ALERTS=false; alert rules will not load.")
        return {"enabled": False, "rules_loaded": False}

    os.environ["SIGNOZ_ALERTS_ENABLED"] = "1"
    logger.info("SigNoz alerts enabled via configuration.")
    return {"enabled": True, "rules_loaded": False}
