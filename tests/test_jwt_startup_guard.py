"""
Test JWT Startup Guard

GOVERNANCE (Phase 1 — Authentication):
Verifies that JWT configuration is validated at startup.
- When AUTH_ENABLED=true, JWT_SECRET_KEY must be set
- When AUTH_ENABLED=true, JWT_ISSUER and JWT_AUDIENCE must be set
"""

import pytest
from unittest.mock import patch, MagicMock
from app.core.policy_guard import _assert_jwt_secrets_configured


class MockSettings:
    """Mock settings for testing."""
    def __init__(self, **kwargs):
        self.AUTH_ENABLED = kwargs.get('AUTH_ENABLED', False)
        self.JWT_SECRET_KEY = kwargs.get('JWT_SECRET_KEY', None)
        self.JWT_ISSUER = kwargs.get('JWT_ISSUER', None)
        self.JWT_AUDIENCE = kwargs.get('JWT_AUDIENCE', None)


class TestJWTStartupGuard:
    """Test JWT startup guard enforcement."""

    def test_auth_disabled_allows_missing_jwt_secrets(self):
        """When AUTH_ENABLED=false, JWT secrets can be missing."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = False
            # Should not raise
            _assert_jwt_secrets_configured()

    def test_auth_enabled_with_all_secrets_passes(self):
        """When AUTH_ENABLED=true and all secrets present, guard passes."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = True
            mock_settings.JWT_SECRET_KEY = "secret123"
            mock_settings.JWT_ISSUER = "easydata-auth"
            mock_settings.JWT_AUDIENCE = "easydata-api"
            # Should not raise
            _assert_jwt_secrets_configured()

    def test_auth_enabled_missing_jwt_secret_key_fails(self):
        """When AUTH_ENABLED=true and JWT_SECRET_KEY missing, guard fails."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = True
            mock_settings.JWT_SECRET_KEY = None  # Missing
            mock_settings.JWT_ISSUER = "easydata-auth"
            mock_settings.JWT_AUDIENCE = "easydata-api"
            
            with pytest.raises(RuntimeError) as exc_info:
                _assert_jwt_secrets_configured()
            
            assert "JWT_SECRET_KEY is missing" in str(exc_info.value)
            assert "Hard Fail" in str(exc_info.value)

    def test_auth_enabled_missing_jwt_issuer_fails(self):
        """When AUTH_ENABLED=true and JWT_ISSUER missing, guard fails."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = True
            mock_settings.JWT_SECRET_KEY = "secret123"
            mock_settings.JWT_ISSUER = None  # Missing
            mock_settings.JWT_AUDIENCE = "easydata-api"
            
            with pytest.raises(RuntimeError) as exc_info:
                _assert_jwt_secrets_configured()
            
            assert "JWT_ISSUER is missing" in str(exc_info.value)
            assert "Hard Fail" in str(exc_info.value)

    def test_auth_enabled_missing_jwt_audience_fails(self):
        """When AUTH_ENABLED=true and JWT_AUDIENCE missing, guard fails."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = True
            mock_settings.JWT_SECRET_KEY = "secret123"
            mock_settings.JWT_ISSUER = "easydata-auth"
            mock_settings.JWT_AUDIENCE = None  # Missing
            
            with pytest.raises(RuntimeError) as exc_info:
                _assert_jwt_secrets_configured()
            
            assert "JWT_AUDIENCE is missing" in str(exc_info.value)
            assert "Hard Fail" in str(exc_info.value)

    def test_auth_enabled_missing_all_secrets_fails_with_all_violations(self):
        """When AUTH_ENABLED=true and all secrets missing, guard fails with all reasons."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = True
            mock_settings.JWT_SECRET_KEY = None
            mock_settings.JWT_ISSUER = None
            mock_settings.JWT_AUDIENCE = None
            
            with pytest.raises(RuntimeError) as exc_info:
                _assert_jwt_secrets_configured()
            
            error_msg = str(exc_info.value)
            assert "JWT_SECRET_KEY is missing" in error_msg
            assert "JWT_ISSUER is missing" in error_msg
            assert "JWT_AUDIENCE is missing" in error_msg
            assert "Hard Fail" in error_msg

    def test_error_message_includes_guidance(self):
        """Error message should include guidance on how to fix."""
        with patch('app.core.policy_guard.settings') as mock_settings:
            mock_settings.AUTH_ENABLED = True
            mock_settings.JWT_SECRET_KEY = None
            mock_settings.JWT_ISSUER = "easydata-auth"
            mock_settings.JWT_AUDIENCE = "easydata-api"
            
            with pytest.raises(RuntimeError) as exc_info:
                _assert_jwt_secrets_configured()
            
            error_msg = str(exc_info.value)
            assert "environment variables" in error_msg.lower()
            assert "exit" in error_msg.lower()
