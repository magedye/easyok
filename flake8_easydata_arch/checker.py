import ast
from typing import Generator, Tuple, Type

# Architectural Contract (ADR-0018)
CORE_PATHS = (
    "app/core",
    "app/api",
    "app/services/orchestration_service.py",
)

ISOLATED_CONCERNS = (
    "app/services/audit",
    "app/services/semantic_cache",
    "app/services/telemetry",
    "app/services/sentry",
    "app/services/ragas",
)

SERVICES_PATH = "app/services"
PROVIDERS_PATH = "app/providers"
API_PATHS = ("app/api", "app/api/v1")
DB_PROVIDER_PATHS = (
    "app/providers/db",
    "app/providers/oracle",
    "app/providers/mssql",
    "app/providers/sqlalchemy",
)

ERRORS = {
    "EDA901": "Core layer must not import Isolated modules: {module}",
    "EDA902": "Isolated layer must not import API modules: {module}",
    "EDA903": "Core layer must not import DB providers directly: {module}",
    "EDA904": "Services layer must not import API modules: {module}",
    "EDA905": "Providers layer must not import API modules: {module}",
    "EDA911": "Inline toggle check detected: {code} - Use factory injection instead",
}


class EasyDataArchChecker:
    """Flake8 plugin enforcing architectural isolation (ADR-0018)."""

    name = "flake8-easydata-arch"
    version = "1.0.0"

    def __init__(self, tree: ast.AST, filename: str):
        self.tree = tree
        self.filename = filename.replace("\\", "/")

    def run(self) -> Generator[Tuple[int, int, str, Type["EasyDataArchChecker"]], None, None]:
        """Main entry point for Flake8."""
        for node in ast.walk(self.tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                module = self._get_module(node)
                if not module:
                    continue

                # EDA901: Core -> Isolated
                if self._is_core() and self._is_isolated(module):
                    yield self._err(node, "EDA901", module)

                # EDA902: Isolated -> API
                if self._is_isolated() and self._is_api(module):
                    yield self._err(node, "EDA902", module)

                # EDA903: Core -> DB Providers
                if self._is_core() and self._is_db_provider(module):
                    yield self._err(node, "EDA903", module)

                # EDA904: Services -> API
                if self._is_services() and self._is_api(module):
                    yield self._err(node, "EDA904", module)

                # EDA905: Providers -> API
                if self._is_providers() and self._is_api(module):
                    yield self._err(node, "EDA905", module)

            # EDA911: Inline toggle checks
            if isinstance(node, ast.If):
                if self._is_inline_toggle_check(node):
                    code_snippet = self._get_code_snippet(node)
                    yield self._err(node, "EDA911", code_snippet)

    def _get_module(self, node: ast.AST) -> str:
        """Extract module name from Import or ImportFrom node."""
        if isinstance(node, ast.Import):
            return node.names[0].name
        if isinstance(node, ast.ImportFrom):
            return node.module
        return None

    def _err(self, node: ast.AST, code: str, module: str) -> Tuple[int, int, str, Type]:
        """Format error tuple for Flake8."""
        return (
            node.lineno,
            node.col_offset,
            f"{code} {ERRORS[code].format(module=module)}",
            type(self),
        )

    def _is_core(self) -> bool:
        """Check if current file is in Core layer."""
        return any(self.filename.startswith(p) for p in CORE_PATHS)

    def _is_isolated(self) -> bool:
        """Check if current file is in Isolated Concerns."""
        return any(self.filename.startswith(p) for p in ISOLATED_CONCERNS)

    def _is_services(self) -> bool:
        """Check if current file is in Services layer."""
        return self.filename.startswith(SERVICES_PATH)

    def _is_providers(self) -> bool:
        """Check if current file is in Providers layer."""
        return self.filename.startswith(PROVIDERS_PATH)

    def _is_api(self, module: str) -> bool:
        """Check if module is API layer."""
        normalized = module.replace(".", "/")
        return any(normalized.startswith(p.replace("app/", "")) for p in API_PATHS)

    def _is_db_provider(self, module: str) -> bool:
        """Check if module is a DB Provider."""
        normalized = module.replace(".", "/")
        return any(normalized.startswith(p.replace("app/", "")) for p in DB_PROVIDER_PATHS)

    def _is_inline_toggle_check(self, node: ast.If) -> bool:
        """Check if node contains inline toggle if statement (if settings.ENABLE_*)."""
        if not isinstance(node.test, ast.Attribute):
            return False
        if not isinstance(node.test.value, ast.Name):
            return False
        # Detect: if settings.ENABLE_*, if not settings.ENABLE_*, etc.
        return (
            node.test.value.id == "settings"
            and node.test.attr.startswith("ENABLE_")
        )

    def _get_code_snippet(self, node: ast.If) -> str:
        """Extract code snippet from If node."""
        if hasattr(node.test, "attr"):
            return f"if settings.{node.test.attr}"
        return "if statement"
