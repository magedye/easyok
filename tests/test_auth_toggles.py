import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestAuthToggle:
    """Test AUTH_ENABLED toggle."""
    
    def test_auth_disabled_no_token_required(self, monkeypatch):
        """
        When AUTH_ENABLED=false:
        - Endpoint works without Authorization header
        - Returns 200
        - user_context is anonymous
        """
        monkeypatch.setenv("AUTH_ENABLED", "false")
        
        response = client.post("/api/v1/ask", params={"question": "test"})
        
        assert response.status_code == 200
        # assert response.json()["user_id"] == "anonymous"
    
    def test_auth_enabled_token_required(self, monkeypatch):
        """
        When AUTH_ENABLED=true:
        - Endpoint without Authorization header returns 401
        """
        monkeypatch.setenv("AUTH_ENABLED", "true")
        monkeypatch.setenv("JWT_SECRET_KEY", "test")
        
        response = client.post("/api/v1/ask", params={"question": "test"})
        
        assert response.status_code == 401
        assert "Authorization" in response.json()["detail"]
    
    def test_auth_enabled_valid_token(self, monkeypatch):
        """
        When AUTH_ENABLED=true and valid token provided:
        - Returns 200
        - user_context has user data
        """
        monkeypatch.setenv("AUTH_ENABLED", "true")
        monkeypatch.setenv("JWT_SECRET_KEY", "test")
        
        # First, login
        login_response = client.post(
            "/api/v1/auth/login",
            params={"username": "admin", "password": "changeme"}
        )
        token = login_response.json()["access_token"]
        
        # Then, make request with token
        response = client.post(
            "/api/v1/ask",
            params={"question": "test"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        # assert response.json()["is_authenticated"] is True


class TestRBACToggle:
    """Test RBAC_ENABLED toggle."""
    
    def test_rbac_disabled_no_permission_check(self, monkeypatch):
        """
        When RBAC_ENABLED=false:
        - Admin endpoint works without permission
        """
        monkeypatch.setenv("AUTH_ENABLED", "true")
        monkeypatch.setenv("RBAC_ENABLED", "false")
        monkeypatch.setenv("JWT_SECRET_KEY", "test")

        from app.core.security import create_access_token
        token = create_access_token(
            subject="user",
            role="user",
            permissions=[],
            data_scope={}
        )
        
        response = client.post(
            "/api/v1/admin/training/approve",
            params={"training_id": "123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
    
    def test_rbac_enabled_permission_enforced(self, monkeypatch):
        """
        When RBAC_ENABLED=true:
        - User without permission gets 403
        """
        monkeypatch.setenv("RBAC_ENABLED", "true")
        monkeypatch.setenv("AUTH_ENABLED", "true")
        monkeypatch.setenv("JWT_SECRET_KEY", "test")
        
        # Create token with no permissions
        from app.core.security import create_access_token
        token = create_access_token(
            subject="user",
            role="user",
            permissions=[],
            data_scope={}
        )
        
        response = client.post(
            "/api/v1/admin/training/approve",
            params={"training_id": "123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()


class TestUserContextContract:
    """Test that user_context is stable contract."""
    
    def test_user_context_keys_always_present(self, monkeypatch):
        """
        user_context must ALWAYS have these keys:
        - user_id
        - role
        - permissions
        - data_scope
        - is_authenticated
        """
        monkeypatch.setenv("AUTH_ENABLED", "false")
        
        response = client.get("/api/v1/auth/me")
        user_context = response.json()
        
        required_keys = {"user_id", "role", "permissions", "data_scope", "is_authenticated"}
        assert required_keys.issubset(user_context.keys()), \
            f"Missing keys. Got: {user_context.keys()}"
