import pytest


def _ensure_admin(user, settings):
    if settings.get("ENV", "").lower() == "local" and str(settings.get("ADMIN_LOCAL_BYPASS", "")).lower() == "true":
        return True
    if user.get("role") != "admin":
        raise PermissionError("INSUFFICIENT_PRIVILEGES")
    return True


def test_admin_guard_blocks_guest(fake_guest_context):
    with pytest.raises(PermissionError):
        _ensure_admin(fake_guest_context, {"ENV": "production", "ADMIN_LOCAL_BYPASS": "false"})


def test_admin_guard_allows_admin(fake_admin_context):
    assert _ensure_admin(fake_admin_context, {"ENV": "production", "ADMIN_LOCAL_BYPASS": "false"}) is True


def test_admin_local_bypass(local_bypass_settings, fake_guest_context):
    assert _ensure_admin(fake_guest_context, local_bypass_settings) is True
