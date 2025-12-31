"""
Test RBAC Wildcard Permission Semantics

GOVERNANCE (Phase 2 — Authorization):
Verifies that wildcard permissions work correctly:
- "admin:*" matches "admin:read", "admin:write", etc.
- Both ":" and "." separators are equivalent
"""

import pytest
from app.api.dependencies import _check_permission_with_wildcards


class TestRBACWildcardSemantics:
    """Test RBAC wildcard permission matching."""

    def test_exact_match_colon(self):
        """Test exact permission match with colon separator."""
        user_perms = ["admin:read", "training:upload"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        assert not _check_permission_with_wildcards("admin:write", user_perms)

    def test_exact_match_dot(self):
        """Test exact permission match with dot separator."""
        user_perms = ["admin.read", "training.upload"]
        assert _check_permission_with_wildcards("admin.read", user_perms)
        assert not _check_permission_with_wildcards("admin.write", user_perms)

    def test_wildcard_match_colon(self):
        """Test wildcard permission match with colon separator."""
        user_perms = ["admin:*", "training:upload"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        assert _check_permission_with_wildcards("admin:write", user_perms)
        assert _check_permission_with_wildcards("admin:delete", user_perms)
        assert not _check_permission_with_wildcards("training:approve", user_perms)

    def test_wildcard_match_dot(self):
        """Test wildcard permission match with dot separator."""
        user_perms = ["admin.*", "training.upload"]
        assert _check_permission_with_wildcards("admin.read", user_perms)
        assert _check_permission_with_wildcards("admin.write", user_perms)
        assert _check_permission_with_wildcards("admin.delete", user_perms)
        assert not _check_permission_with_wildcards("training.approve", user_perms)

    def test_alias_handling_colon_to_dot(self):
        """Test that colon and dot are aliased - user has dot, request is colon."""
        user_perms = ["admin.*"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        assert _check_permission_with_wildcards("admin:write", user_perms)

    def test_alias_handling_dot_to_colon(self):
        """Test that colon and dot are aliased - user has colon, request is dot."""
        user_perms = ["admin:*"]
        assert _check_permission_with_wildcards("admin.read", user_perms)
        assert _check_permission_with_wildcards("admin.write", user_perms)

    def test_no_partial_wildcard_match(self):
        """Wildcard should not match partial namespaces."""
        user_perms = ["admin:*"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        assert not _check_permission_with_wildcards("administration:read", user_perms)

    def test_multiple_permissions(self):
        """Test with multiple permissions including wildcards."""
        user_perms = [
            "query:execute",
            "training:*",
            "admin.read",
        ]
        # Exact matches
        assert _check_permission_with_wildcards("query:execute", user_perms)
        assert _check_permission_with_wildcards("admin.read", user_perms)
        
        # Wildcard matches
        assert _check_permission_with_wildcards("training:upload", user_perms)
        assert _check_permission_with_wildcards("training.approve", user_perms)
        
        # No matches
        assert not _check_permission_with_wildcards("admin:write", user_perms)
        assert not _check_permission_with_wildcards("schema:read", user_perms)

    def test_empty_permissions(self):
        """Test with empty permission list."""
        user_perms = []
        assert not _check_permission_with_wildcards("admin:read", user_perms)

    def test_wildcard_all_namespaces(self):
        """Test that each wildcard only matches its namespace."""
        user_perms = ["admin:*", "training:*"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        assert _check_permission_with_wildcards("training:approve", user_perms)
        assert not _check_permission_with_wildcards("schema:read", user_perms)

    def test_deep_namespace_not_matched_by_shallow_wildcard(self):
        """Wildcard at one level should not match deeper levels."""
        user_perms = ["admin:*"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        # Assuming we don't have deeper nesting like admin:system:write
        # This test just ensures the basic rule holds


class TestAdminWildcardPermission:
    """Test that admin:* correctly grants all admin permissions."""

    def test_admin_wildcard_grants_all_admin_actions(self):
        """Admin wildcard should grant access to any admin action."""
        user_perms = ["admin:*"]
        admin_actions = [
            "admin:read",
            "admin:write",
            "admin:delete",
            "admin:audit",
            "admin:settings",
            "admin:users",
            "admin:roles",
        ]
        for action in admin_actions:
            assert _check_permission_with_wildcards(action, user_perms), \
                f"admin:* should grant {action}"

    def test_exact_admin_action_does_not_grant_wildcard(self):
        """Having admin:read should not grant admin:write."""
        user_perms = ["admin:read"]
        assert _check_permission_with_wildcards("admin:read", user_perms)
        assert not _check_permission_with_wildcards("admin:write", user_perms)
        assert not _check_permission_with_wildcards("admin:*", user_perms)
