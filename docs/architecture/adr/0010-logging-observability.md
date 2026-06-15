# ADR-0010: Logging & observability

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Team (Guido, lead developer)

## Context

The system runs two services (FastAPI backend, Next.js frontend) on Azure Container Apps (ADR-0004), with a DDD backend (ADR-0008) and TDD (ADR-0009). Application Insights was already named as the monitoring service. We now need a concrete logging and observability approach: log format, instrumentation, how a request is traced across the frontend→backend hop, what may and may not be logged (GDPR — the team and audience are in the EU), and retention.

Forces at play: one developer (low operational budget), EU data-residency and privacy constraints, the desire to debug issues quickly across two services, and the DDD rule that the `domain` layer stays framework-free.

## Decision

Adopt **OpenTelemetry (OTel) as the instrumentation standard, exporting to Azure Monitor / Application Insights** (backed by a Log Analytics workspace in Italy North), with **structured JSON logging** to stdout.

- **Format:** structured JSON logs (Python: `structlog` or stdlib logging + JSON formatter; Next.js: `pino`). Container Apps captures stdout into Log Analytics; OTel sends traces/metrics/logs to App Insights.
- **Correlation:** propagate **W3C trace context** (`traceparent`) from the Next.js frontend to the FastAPI backend; every log line carries the trace/correlation ID so one request is traceable end-to-end across both services.
- **Levels:** standard severity (DEBUG/INFO/WARNING/ERROR/CRITICAL); **INFO and above in production**, DEBUG in development, controlled by config (env var from Key Vault/Container Apps config).
- **What to log:** request lifecycle (method, path, status, latency), meaningful domain/application events (e.g. article published, login success/failure), and errors with stack traces.
- **What NOT to log (GDPR):** no secrets/tokens/passwords, no full request bodies, no PII such as subscriber emails or IPs beyond what is strictly needed; apply redaction/scrubbing at the logging boundary.
- **Layering:** logging is done in the `application`, `interfaces`, and `infrastructure` layers via middleware and a small logging port; the `domain` layer emits no logs and imports no logging library (preserves ADR-0008's dependency rule).
- **Health:** liveness/readiness endpoints back Container Apps probes (operational signal distinct from logs).
- **Retention:** configure Log Analytics retention to a defined window (default **30–90 days**, tuned for cost vs. compliance) via Bicep (ADR-0002 IaC is Bicep).

## Options Considered

### Option A: OpenTelemetry + Azure Monitor / App Insights (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — OTel setup in both apps |
| Cost | Low–medium (App Insights/Log Analytics ingestion + retention) |
| Scalability | High — managed, vendor-neutral instrumentation |
| Team familiarity | Good; standard, well-documented path on Azure |

**Pros:** Vendor-neutral instrumentation (portable if we ever leave App Insights); native Azure integration; unified traces + metrics + logs; distributed tracing across both services; future-proof (OTel is the industry direction and the recommended Azure path).
**Cons:** More initial wiring than a single SDK; ingestion/retention cost must be watched.

### Option B: Classic Application Insights SDK (direct)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Low–medium |
| Scalability | Medium |
| Team familiarity | Good |

**Pros:** Simplest direct integration with App Insights.
**Cons:** Vendor-locked; the classic SDKs are being superseded by the OpenTelemetry-based offering — adopting it now would be building on a deprecating path.

### Option C: Third-party stack (Datadog / Grafana+Loki / ELK)
| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Cost | High (SaaS) or high ops (self-host) |
| Scalability | High |
| Team familiarity | Varies |

**Pros:** Powerful dashboards and querying; mature ecosystems.
**Cons:** Added cost and/or operational burden, and data leaves Azure (EU-residency review needed) — unjustified for a one-developer MVP already standardized on Azure.

## Trade-off Analysis

The classic App Insights SDK is the quickest to wire but builds on a deprecating path and locks us in. A third-party stack is overkill in cost/ops for this scale and raises data-residency questions. OpenTelemetry exporting to Azure Monitor keeps everything inside Azure (EU region, low cost), gives true distributed tracing across the two services, and keeps instrumentation vendor-neutral so the backend (a future scale concern) isn't locked to one APM. The cost is a bit more setup, which is a one-time expense.

## Consequences

- **Easier:** End-to-end request tracing across frontend and backend; consistent machine-queryable logs; managed, low-cost Azure-native observability; portability of instrumentation.
- **Harder:** OTel must be configured in both apps; ingestion/retention cost needs monitoring; redaction discipline required to stay GDPR-safe.
- **Revisit if:** Volume/cost grows enough to warrant sampling tuning, or richer dashboards justify a dedicated APM.

## Action Items
1. [ ] Add the Azure Monitor OpenTelemetry distro to the FastAPI app; JSON logging via structlog with trace-id binding.
2. [ ] Add OTel + `pino` JSON logging to the Next.js app; propagate `traceparent` on API calls.
3. [ ] Implement request-logging middleware and a PII/secret redaction filter; add a logging port so `domain` stays clean.
4. [ ] Provision Log Analytics workspace + App Insights and set retention via Bicep.
5. [ ] Add liveness/readiness endpoints and wire Container Apps probes.
6. [ ] Add tests asserting that secrets/PII are not emitted in logs (ties into ADR-0009 TDD).
