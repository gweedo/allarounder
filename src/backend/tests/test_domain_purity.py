"""
Domain layer must not import any framework code.
This test enforces ADR-0008: the strict inward dependency rule.
"""

import ast
import pathlib


FORBIDDEN_TOP_LEVEL = {"fastapi", "sqlalchemy", "structlog", "pydantic", "uvicorn"}
DOMAIN_DIR = pathlib.Path(__file__).parent.parent / "app" / "domain"


def _imports_in_file(path: pathlib.Path) -> list[str]:
    tree = ast.parse(path.read_text())
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.append(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                found.append(node.module.split(".")[0])
    return found


def test_domain_dir_exists():
    assert DOMAIN_DIR.is_dir(), "domain/ directory must exist under app/"


def test_domain_layer_has_no_framework_imports():
    violations = []
    for py_file in DOMAIN_DIR.rglob("*.py"):
        for imp in _imports_in_file(py_file):
            if imp in FORBIDDEN_TOP_LEVEL:
                violations.append(f"{py_file.name}: forbidden import '{imp}'")
    assert not violations, "\n".join(violations)
