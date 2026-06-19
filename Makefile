.PHONY: ci backend-ci frontend-ci install backend-install frontend-install

# ── Installation ──────────────────────────────────────────────────────────────

backend-install:
	pip install -e "src/backend[dev]"

frontend-install:
	cd src/frontend && npm ci

install: backend-install frontend-install
	@command -v pre-commit >/dev/null 2>&1 && pre-commit install || \
	  echo "pre-commit not found — run: pip install pre-commit && pre-commit install"

# ── CI parity (mirrors GitHub Actions exactly) ────────────────────────────────

backend-ci:
	cd src/backend && python -m ruff check .
	cd src/backend && python -m mypy app
	cd src/backend && python -m pytest --cov=app --cov-fail-under=80

frontend-ci:
	cd src/frontend && npm run lint
	cd src/frontend && npm run typecheck
	cd src/frontend && npm test -- --coverage

ci: backend-ci frontend-ci
	@echo "All checks passed — safe to push."
