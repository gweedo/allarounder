# Retrospective — What Went Wrong, and How to Fix Skills & Orchestrator for New Projects

**Date:** 2026-06-25
**Context:** Bringing the Allarounder backend to a working first deploy required chasing a
six-link chain of failures across one long session, on top of ten failures recorded in the
earlier deploy incident. The bugs were individually small; the cost was in *how long each took
to surface* and *how many were the same class of problem repeating*. This document abstracts
from the specific bugs to the systemic gaps, and proposes defaults a scaffold/skill/orchestrator
should ship so a new project never re-walks this path.

---

## 1. Executive summary

The single most expensive property of this session was **false success signals**. The CI
migration job reported `Succeeded` on every deploy while creating **zero** tables, because the
migration scripts were excluded from the Docker image and Alembic, finding nothing to do, exited
0. "Green" meant "the command ran," not "the intended effect happened." Every downstream symptom
(no admin user, empty DB, silent no-ops) flowed from trusting an exit code instead of verifying
an outcome.

The second most expensive property was **untested critical paths**. Database migrations — the
most consequential operation in the system — had *zero* test coverage, because the API tests
mock the persistence layer. Two migrations carried a latent bug (`sa.Enum(create_type=False)`,
where the flag is silently ignored) that could only surface on a real `alembic upgrade head`,
which never ran until the very first production-bound deploy.

The third was **recurrence of a known footgun**: a database engine created without the project's
Entra-token connection listener — the exact root cause of Failure 1 in the prior incident —
reappeared in a new code path (the bootstrap CLI), because nothing carried that lesson forward
into new code.

Everything else (connection-pool exhaustion, a stale-branch import error, a missing `h1`) was
real but secondary, and in one case (connection exhaustion) actively misleading: it was a genuine
bug that masqueraded as the cause of the empty database for several diagnostic rounds.

---

## 2. The failure chain (this session)

| # | Symptom | Root cause | Class |
|---|---------|------------|-------|
| 1 | E2E: no `<h1>` on homepage | Only the hero article rendered an `h1`; empty DB → none. Site name was a `<p>` | Untested empty/edge state |
| 2 | CLI: connection rejected | CLI used `create_engine()`, bypassing the Entra-token `do_connect` listener | **Recurring known footgun** (= prior Failure 1) |
| 3 | CLI: `ImportError` | Branch cut from a **stale local `main`**; reintroduced a symbol origin had renamed | Branch hygiene |
| 4 | Postgres connection exhaustion | `get_engine()` uncached → a new pool per request; health probes × stale revisions drained `max_connections` | Resource lifecycle / **red herring** |
| 5 | Empty DB; migrations "Succeeded" doing nothing | `.dockerignore` excluded `alembic/versions/*.py`; image shipped no migration scripts | **False success signal** + artifact parity |
| 6 | First real migration aborts | `sa.Enum(create_type=False)` ignored (flag only valid on `postgresql.ENUM`) → enum created twice | **Untested critical path** |
| 7 | Admin login fails / `/admin` bounces | No Next.js proxy for `/api/*` (backend is internal-only); SSR env var named `NEXT_PUBLIC_API_URL` but code reads `API_URL`; frontend container missing `JWT_SECRET_KEY` | **Untested critical path** |

Each link could only be seen *after* the previous one was fixed, because each masked the next.
That is the signature of a system with no end-to-end verification: defects queue up behind the
first false-green and reveal themselves one deploy at a time.

Failure #7 (admin login) is the same disease one layer up: the entire browser→backend path was
never exercised. The E2E suite asserts the login page *renders* but never that a login
*succeeds*, so three independent breakages (missing API proxy, a wrong env-var name that left
`API_URL` unset and silently emptied every server-rendered page, and a missing JWT secret on the
frontend) all shipped green. It surfaced only when a human tried to log in — the most expensive
possible detector.

---

## 3. Root-cause themes (and the control that would have caught each)

### Theme A — "Exit 0" is not "it worked"
A batch job, a migration, a deploy step can succeed *at running* while failing *at its purpose*.
The migration job is the canonical example: it exited 0 forever while the schema never existed.

> **Control:** Every state-changing step must assert its **intended postcondition**, not its exit
> code. A migration step verifies the expected tables/revision exist. A deploy verifies the new
> revision serves the new image and a real request returns expected data — not just `200`.

### Theme B — The most critical path had zero tests
Migrations were never executed anywhere — not in unit tests (mocked repos), not in an integration
test, not in CI. The TDD mandate (ADR-0009) was satisfied at the unit level while the highest-risk
operation had no coverage at all.

> **Control:** Ship a **migration round-trip test by default** (`upgrade head` → assert tables →
> `downgrade base` → assert clean → `upgrade head`) running against a real database in CI. This
> single test, present from day one, would have caught both #5 (no scripts → no tables created)
> and #6 (enum double-create).

### Theme C — Local/CI/prod parity gaps
The enum bug behaved differently in theory (mocks, `create_all`) than against real PostgreSQL.
Mock-only tests cannot catch dialect-specific or DDL-ordering bugs.

> **Control:** The critical-path integration tests must run against the **same engine** prod uses
> (real Postgres via service container / testcontainers), not SQLite or mocks. Parity is the only
> thing that catches "works in the test double, fails on the real thing."

### Theme D — Build artifacts can silently diverge from the tested tree
`.dockerignore` removed runtime-required files. Nothing compared "what the tests ran against" to
"what the image actually contains."

> **Control:** A scaffold check (or skill step) that the built image contains the critical runtime
> assets (migration scripts, templates, static needed at runtime). Lint `.dockerignore`/`.gitignore`
> against a known required-paths allowlist. At minimum, build the image and assert key paths exist
> before declaring a Docker change done — exactly the check that confirmed the #62 fix.

### Theme E — Known footguns were not carried into new code
The Entra-listener engine bug (#2) was *identical* to a documented prior failure. The fix pattern
existed; the new code path didn't use it.

> **Control:** Maintain a per-stack **footgun catalog** (memory/CLAUDE.md) of "never do X; always
> use Y" with the *why*, and have the orchestrator surface the relevant entries when touching that
> area (any new DB-engine creation → "use `get_engine()`; AD-only Postgres needs the token
> listener"). This project *had* the memory; it wasn't consulted when writing the new path.

### Theme F — Stale-branch hygiene
A branch cut from a long-diverged local `main` reintroduced a deleted symbol.

> **Control:** Orchestrator default: branch from `origin/<default>` after fetch, never local; and
> when reasoning about deployed behavior, read `git show origin/main:<path>`, not the working tree.
> Treat a diverged local default branch as a hard warning.

### Theme G — Multi-environment work is one playbook, run N times
Staging and production were provisioned identically but verified independently and late. Production
is now known to carry the *same* empty-DB state and will need the same deploy + verify + bootstrap.

> **Control:** Treat environments as the *same* checklist applied per-env, with explicit
> per-env verification gates — not "staging worked, therefore done."

### Theme H — Diagnosis discipline under cascading failures
We followed two red herrings (a recurring permission hypothesis; the real-but-unrelated connection
exhaustion) before reaching the cause. When a fix doesn't move the symptom, the symptom — not the
last fix — must drive the next step.

> **Control:** When a fix lands and the symptom persists, **re-derive from the symptom** and
> demand a discriminating observation (here: "does `alembic_version` have a row and do the tables
> exist?") before forming the next hypothesis. Don't let "I just fixed something" imply "I fixed
> *this*."

### Theme I — Framework resource-lifecycle footguns
Per-request engine creation is an easy, plausible-looking mistake with a delayed, catastrophic
failure mode (pool exhaustion under probe traffic).

> **Control:** The scaffold's DB module should ship correct-by-default: one cached pooled engine,
> a separate `NullPool` engine for one-shot processes (migrations/CLI), and `pool_pre_ping` +
> `pool_recycle` for cloud databases that drop idle connections.

---

## 4. Concrete recommendations

### 4a. Project scaffold / skill defaults (ship these on `init`)
1. **Migration round-trip test** wired into CI against a real DB service. Non-optional.
2. **DB engine module** with: cached pooled engine, `NullPool` one-shot engine, `pool_pre_ping`,
   `pool_recycle`, and (where relevant) the managed-identity token listener — used by app, CLI,
   *and* `alembic/env.py` so no path can bypass it.
3. **Image-content assertion** in CI: after build, assert critical runtime paths exist in the
   image; lint `.dockerignore` against a required-paths allowlist.
4. **Deploy steps assert postconditions**, never bare exit codes: migration → tables/revision
   present; deploy → new image serving + functional probe; bootstrap → row exists.
5. **Bootstrap/admin tooling** that reads secrets interactively (no secret on the command line)
   and uses the one-shot engine.
6. **Empty-state coverage**: list/landing components must have a test for the zero-rows state
   (stable heading, empty message), since first deploys always start empty.

### 4b. Orchestrator / process gates
1. **Branch from `origin/<default>`**; flag a diverged local default branch; verify deployed code
   via `git show origin/main:<path>`.
2. **Outcome verification gate** before marking any deploy/migration task done — the artifact must
   be observed (tables exist, request returns data), not inferred from green.
3. **Footgun surfacing**: when a task touches an area with catalogued footguns, inject those
   entries into context before writing code.
4. **Environment-parity checklist**: a deploy playbook applied per-environment with explicit
   per-env verification; "staging done" never implies "prod done."
5. **Red-herring discipline**: if a merged fix doesn't move the symptom, require a fresh
   discriminating observation before the next change.

### 4c. Institutional memory
- Keep a living **footgun catalog** per stack with *why* and *how to apply* (this project's memory
  now has: AD-only Postgres requires the token listener; local `main` is diverged; `.dockerignore`
  must not drop migration scripts; cache the engine). The gap was not *recording* — it was
  *consulting* the catalog at write-time. Orchestrator should pull, not rely on recall.

---

## 4d. Design decision — the admin edge-gate (the two implementation options)

Fixing Failure #7 forced a genuine architecture choice for how the Next.js `/admin`
middleware decides whether a request is authenticated. Both options assume the **backend
remains the real authority** — it fully verifies the token on every API call regardless. The
middleware only controls the *edge redirect* (send anonymous users to `/admin/login`). The two
options, recorded so future projects can make the call deliberately rather than by accident:

### Option A — Cookie presence only
The middleware checks that the `access_token` cookie merely exists; it does not crack it open.

- **Pros:** No secret on the frontend at all — no Key Vault secret ref, no role assignment, no
  shared signing key. Smallest attack surface and the simplest infra. The middleware can't be a
  source of secret leakage because it holds no secret.
- **Cons:** Weaker edge gate. A stale or forged cookie passes the middleware and is only rejected
  by the backend on the first data call — the user briefly sees an admin shell that then errors,
  rather than a clean redirect to login.
- **Best when:** You want minimal secret distribution and treat the middleware purely as UX.

### Option B — Full cryptographic verify *(chosen)*
The middleware runs `jwtVerify(token, JWT_SECRET_KEY, { algorithms: ["HS256"] })`.

- **Pros:** Strong edge gate — expired/forged/tampered tokens are rejected at the edge, so
  unauthenticated users never reach the admin shell at all. It also matches the middleware code
  already written, so it's the smaller diff and least surprising behaviour.
- **Cons:** HS256 is symmetric, so verifying requires the **same secret used to sign**. The
  frontend container must therefore receive the `jwt-signing-key` (via a Key Vault secret ref +
  a Key Vault Secrets User role assignment for the frontend identity). That broadens exposure of
  the signing key from one workload to two.
- **Best when:** You want the edge to be authoritative and accept distributing the signing key to
  a second trusted workload inside the same environment.

**Decision & reason:** Chose **Option B** — a stronger, authoritative edge gate, matching the
existing middleware, was preferred over minimizing secret distribution. The cost (the frontend
identity now reads the same Key Vault secret as the backend, inside the same private Container
Apps environment) was judged acceptable.

**Future hardening (avoids the trade-off entirely):** switch JWT signing to **RS256**
(asymmetric). The backend signs with a private key; the frontend verifies with the *public* key
and never holds anything secret. That gives Option B's strong edge gate *and* Option A's minimal
secret surface, at the cost of a one-time signing-algorithm migration. Recommended as the default
for new projects that put auth-aware middleware in front of an SSR app.

> **Scaffold takeaway:** if a project ships edge middleware that inspects auth tokens, pick the
> signing scheme up front. Default to **asymmetric (RS256)** so the verifier never needs the
> signing secret — it removes this decision and its infra plumbing from every future project.

---

## 5. The one-line lesson per failure (for a checklist)

- **#1** Test the empty state — first deploys are always empty.
- **#2** Never create a DB engine outside the blessed factory; AD-only DBs need the token listener.
- **#3** Branch from `origin/main`; verify deployed code with `git show`, not the working tree.
- **#4** One cached engine; `NullPool` for one-shots; `pre_ping` for cloud DBs.
- **#5** A job exiting 0 is not proof; verify the artifact. Don't let `.dockerignore` drop runtime files.
- **#6** Run real migrations against a real DB in CI; mocks hide DDL and dialect bugs.
- **#7** E2E the *login*, not just the login page. Proxy browser→internal-backend calls through the SSR app; keep env-var names in sync with the code; prefer asymmetric JWT so edge middleware never holds the signing secret.

> **If a new project adopts only one thing from this:** a CI test that runs the real migration
> chain against a real database, plus the rule that every deploy step verifies its outcome rather
> than its exit code. Those two alone would have collapsed this six-link chain to zero.

---

## 6. The admin-login marathon — anatomy of a debugging cascade

Failure #7 (admin login) deserves its own chapter, because *fixing* it took far longer than it
should have — not because the bug was hard, but because the **diagnosis kept chasing the wrong
thing**. The real root cause was one line; reaching it cost an afternoon of detours. The detours
are the lesson.

### What was actually wrong (in order of discovery)
1. **No API proxy** — the browser POSTs to `/api/admin/auth/login` on the frontend origin; the
   backend is internal-only and Front Door routes `/*` to the frontend, so it must be proxied by the
   SSR app.
2. **Wrong env-var name** — code reads `API_URL`; bicep set `NEXT_PUBLIC_API_URL`. (This also
   silently emptied every server-rendered page.)
3. **Missing JWT secret** on the frontend container (the middleware verifies the cookie).
4. **`acr-pull-assignments` idempotency bug** — blocked the full Bicep redeploy, forcing surgical
   `az` CLI changes instead.
5. **Multiple-revision traffic pinning** — `az containerapp update` created new revisions at **0%
   traffic**; every probe hit an *older* revision, so each fix looked like it did nothing.
6. **Build-time-baked rewrite (the real root cause)** — the `next.config` rewrite froze its
   destination to the `http://backend:8000` fallback at **build** time, because `API_URL` was unset
   during the CI build. Runtime env could never change it. Fixed with a runtime route handler.

### The detours, and why each happened
- **Cert red herring (twice).** "Internal HTTPS must be a TLS-trust problem" felt obvious, so two
  rounds went into cert theory and a `NODE_TLS_REJECT_UNAUTHORIZED=0` test — which *also* failed,
  because the request wasn't even using the HTTPS URL (it was the baked `http://backend:8000`). We
  theorized about the hop before confirming which hop was being made.
- **Traffic pinning corrupted the signal.** Because new revisions got 0% traffic, several "the fix
  didn't work" conclusions were actually "the fix isn't serving." Hours of test results were invalid
  because they hit the wrong revision.
- **The breakthrough was a log line, not a theory.** Pulling the *serving* revision's logs showed
  `Failed to proxy http://backend:8000/... ENOTFOUND backend`, which instantly collapsed the cert,
  connectivity, and env theories at once. One real error beat a day of inference.

### Meta-lessons (the expensive ones)
- **Get the real error before changing anything.** Every detour came from acting on a hypothesis
  instead of an observation. Rule: when a fix doesn't move the symptom, the next step is a new
  *observation* (a log line, the exact error, the actual served bytes) — never another blind change.
- **Confirm which artifact is actually live.** In any blue-green / multi-revision system, "I changed
  X" ≠ "the running thing has X." Verify which revision/image/commit serves traffic *before*
  interpreting a test. Prefer single-revision mode (or always pin traffic to latest) unless you
  specifically need weighted rollouts.
- **Know what's frozen at build vs read at runtime.** `next.config` rewrites, `NEXT_PUBLIC_*` vars,
  and anything bundled are **build-time**; route handlers, server components, and `process.env`
  reads are **runtime**. A value that varies per environment (an internal backend URL) must live on
  the runtime side. This one distinction would have prevented the whole marathon.
- **Diagnose from inside the box.** "Does the internal HTTPS hop work?" was answered in seconds by
  running the exact call (`node -e "fetch(...)"`) from inside the frontend container — after a day of
  guessing from outside. Replicate the failing call in the failing environment.
- **Make failures self-diagnosing.** The route handler now returns a `502` with the real fetch error
  and cause instead of an opaque `500`. Opaque error surfaces are how a one-line bug becomes a day.
- **Surgical CLI changes are a bridge, not a fix.** We applied the frontend KV role / secret / env
  via `az` because the Bicep deploy was blocked. It works, but it's drift waiting to happen — and it
  makes the thing blocking the IaC deploy (the `acr-pull-assignments` bug) a priority, because it
  will block every future deploy and the production promotion.

### Controls a scaffold/orchestrator should add from this chapter
1. **A login smoke test in CI/CD** that performs a real `POST /login` against the deployed stack and
   asserts `200` + `Set-Cookie` — not "the login page renders." Catches the proxy, env name, secret,
   and cookie forwarding in one shot.
2. **A "which revision serves traffic?" assertion** in the deploy step, and single-revision mode by
   default unless weighted traffic is explicitly required.
3. **A build-vs-runtime config check**: flag env vars referenced in `next.config`
   rewrites/redirects (build-time) that are expected to vary per environment.
4. **Idempotent role-assignment modules** (deterministic `guid()` names, tolerate pre-existing) so a
   second `az deployment group create` never fails on `RoleAssignmentExists`.

---

## 7. The single most important takeaway

Across **both** halves of this session — the migration chain and the admin-login marathon — the same
two disciplines would have prevented essentially all of it:

1. **End-to-end smoke tests of the real critical paths** (migrate → tables exist; login → 200 +
   cookie) against **real** infrastructure, wired into the deploy. Mocks and "page renders" checks
   hid every single bug.
2. **Verify the outcome, never the exit code — and confirm which artifact is live before believing a
   test.** "Job succeeded," "I set the env," "I deployed the fix" were all true and all irrelevant,
   because the *effect* wasn't verified and the *serving* artifact wasn't confirmed.

Everything else in this document is an instance of one of those two.
