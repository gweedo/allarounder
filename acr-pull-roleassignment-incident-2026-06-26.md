# Incident Report — AcrPull role-assignment name divergence blocked all full Bicep deploys

**Date:** 2026-06-26
**Severity:** High (blocked every `infra/main.bicep` deployment, including the production promotion)
**Status:** Resolved on staging; production convergence deferred until PR #69 merges
**Fix:** PR #69 (`fix/acr-pull-idempotency`)
**Affected component:** `infra/modules/acr-pull-assignments.bicep` / Azure RBAC on the shared ACR

---

## 1. Summary

A full `az deployment group create --template-file infra/main.bicep …` failed in the
`acr-pull-assignments` nested deployment with **HTTP 409 `RoleAssignmentExists`**. Because an ARM
deployment is a single goal-state submission, that one 409 aborted the whole operation — so *every*
infrastructure change and the **production promotion** were blocked behind it.

Root cause was a **role-assignment name seed divergence**: an earlier generation of the template named
the AcrPull assignments from the managed identity's **resourceId**, while the current module names them
from the identity's **principalId**. Both are deterministic `guid()` outputs, but different inputs
produce different names for the *same* `(principalId, roleDefinitionId, scope)` triple. ARM forbids a
second assignment for an already-covered triple regardless of name, so the current template collided
with the leftover old-named assignments.

The template was already correct. The fix was **one-time state convergence** — delete the stale
assignments so the deterministic-named ones can be (re)created and owned by IaC going forward — shipped
as a guarded runbook script plus a documenting comment, with no change to module logic.

---

## 2. Impact

- Every full `az deployment group create` on `infra/main.bicep` failed → no infra changes could land
  via IaC.
- The **production promotion** (Task 2 of the deploy handoff) was blocked.
- Forced out-of-band remediation: frontend admin-login state (`API_URL`, `JWT_SECRET_KEY` secretref,
  the frontend `Key Vault Secrets User` assignment) had to be applied to staging via `az` CLI rather
  than Bicep, creating drift that only a successful full deploy can reconcile.
- No customer-facing outage: running Container Apps revisions had already pulled their images, so the
  missing/duplicate AcrPull grant did not stop serving traffic. The blast radius was the deployment
  pipeline, not the live site.

---

## 3. Technical root cause

### 3.1 Relevant ARM/RBAC semantics

- Role assignments are ARM resources (`Microsoft.Authorization/roleAssignments`). The resource **name
  must be a GUID** and is the assignment's identity within its scope; a deployment is a `PUT` to
  `…/roleAssignments/{name}`, so re-`PUT`ting the same name is an idempotent upsert.
- ARM separately enforces uniqueness on the **`(principalId, roleDefinitionId, scope)` triple**.
  Creating a *second* assignment for an already-covered triple under a **different** name returns
  **409 `RoleAssignmentExists`**.
- Idempotent RBAC-as-code therefore depends on the assignment **name being a deterministic function of
  the triple** — the convention `guid(scope, principalId, roleDefinitionId)` — so re-deploys collapse
  onto the same resource instead of minting a duplicate.

### 3.2 The divergence

| | Name seed | Second argument resolves to |
|---|---|---|
| **Original** (inline in `container-apps.bicep`) | `guid(acrId, <uami>.id, acrPullRoleId)` | the UAMI **resourceId** (`/subscriptions/…/providers/Microsoft.ManagedIdentity/userAssignedIdentities/…`) |
| **Current** (`acr-pull-assignments.bicep`) | `guid(acrRef.id, <principalId>, acrPullRoleId)` | the UAMI **`principalId`** (Entra objectId GUID) |

`<uami>.id` and `principalId` are different strings for the same identity → `guid()` yields a different
assignment **name**, while the underlying **triple** (`principalId`, AcrPull `roleDefinitionId`
`7f951dda-4ed3-4680-a7ca-43fe172d538d`, ACR resource scope) is unchanged. The current template's `PUT`
therefore hit a scope already covered by the old-named assignment → 409.

### 3.3 Corroborating evidence

- The four live assignment names were **v5 (name-based) GUIDs**. `az role assignment create`/portal
  mint **v4 (random)** names; Bicep `guid()` mints v5 — confirming these were template-generated under
  the *old* seed, not hand-created. This also ruled out `existing`-by-name as a fix (the name is not
  deterministically derivable from the current template).
- Git history (`git log -p` on `infra/main.bicep` / the module) shows the grant moved out of
  `container-apps.bicep` into a dedicated module and the seed's second arg changed from `<identity>.id`
  to `principalId` at that time.

### 3.4 Scope topology

The ACR (`allarounderstgacr`, RG `allarounder-staging`) is **shared**: `production.bicepparam` sets
`deployAcr=false` and `acrResourceGroup=allarounder-staging` so production references it for
digest-based promotion. The module deploys with `scope: resourceGroup(acrResourceGroup)`, resolves the
registry via an `existing` reference, and nests each assignment at `scope: acrRef` (the registry
resource). All four assignments (staging be/fe + production be/fe) sit at the **same registry scope** on
**distinct principals** — so the collision was strictly old-name vs new-name per principal, not a
cross-environment conflict.

---

## 4. Resolution

The module is correct; the leftover Azure state is what diverged. Fix = converge state, keep the
deterministic template as the owner.

1. **`infra/scripts/converge-acr-pull-assignments.sh <env> [--apply]`** — resolves the environment's
   backend/frontend UAMI `principalId`s, lists their `AcrPull` assignments at the registry scope, and
   deletes the stale ones. **Dry-run by default;** `--apply` required to delete. (Scope match uses the
   registry suffix, not an `==` on the full id, because `az acr show` returns `resourceGroups`-cased ids
   while role-assignment `scope` comes back lowercased — an exact compare silently misses, and the
   suffix match also excludes any inherited RG/subscription-scoped grant.)
2. Re-`PUT` from the current template. With the triple no longer present at scope, the
   deterministic-named assignment is created cleanly; every subsequent deploy is an idempotent upsert.

### Considered and rejected

- **Reference as `existing`** — requires the actual (non-deterministic, old-seed) name; surrenders IaC
  ownership. Rejected.
- **Gate creation behind a `bool` param** — pure-code unblock but leaves the assignment unmanaged
  (permanent drift); easy for a solo maintainer to misremember. Rejected.
- **`deploymentScript` create-if-not-exists** — fully IaC but provisions a container instance
  (cost/complexity) for a one-time convergence. Overkill. Rejected.

---

## 5. Verification

- `az bicep build infra/main.bicep` compiles clean (one pre-existing, unrelated lint warning).
- Read-only dry run listed exactly the four stale assignments reported by `az role assignment list`
  (staging + production, backend + frontend).
- On **staging**: ran `--apply` (deleted `d55fd041…`, `860eb82b…`), re-deployed the module → `Succeeded`
  with the deterministic names (`07cc4528…` backend, `77990dcd…` frontend), then **re-deployed the
  module a second time → `Succeeded`** with no 409. The second run is the regression proof: it is the
  exact operation that previously failed.
- Confirmed the staging Container App image digests (`d251c3d…` backend, `77dcbca…` frontend) were
  unchanged before and after — the convergence touched only RBAC.

### Why the full `main.bicep` deploy was deliberately *not* run

`staging.bicepparam` pins `backendImage`/`frontendImage` to the `containerapps-helloworld` placeholder
(intended for first provisioning only). A full `az deployment group create` would `PUT` the Container
Apps with the placeholder digest, superseding the CI-deployed revision (and, under ACA multiple-revision
mode, spinning a new revision off the wrong image). The full template also reconciles the out-of-band
frontend admin-login drift — which is desirable, but should run with the **correct digest injected by
CI**, not a manual placeholder deploy. The convergence was therefore scoped to the
`acr-pull-assignments` module alone.

---

## 6. Lessons and controls

1. **Never change the name seed of an existing role assignment.** The `guid(scope, principalId,
   roleDefinitionId)` triad is a stable contract; altering any seed input (e.g. swapping
   `identity.id` ↔ `principalId`) orphans the prior assignment and guarantees a `RoleAssignmentExists`
   collision on the next deploy. If a refactor must change it, plan the state convergence in the same
   change.
2. **Standardize the seed convention** across all role-assignment modules (`scope`, `principalId`,
   `roleDefinitionId`) and lint/review for it, so a future module can't reintroduce the divergence.
3. **"Job/exit succeeded" ≠ "effect verified."** Consistent with the prior deploy retrospective: the
   regression proof here was re-running the failing operation and observing the new names, not trusting
   a single green deploy.
4. **Treat shared, cross-environment resources (the ACR) explicitly.** Document that the registry is
   shared and that RBAC on it spans both environments, so per-environment cleanup targets the right
   principals at the right scope.
5. **Reconcile out-of-band drift through CI, not manual full deploys**, whenever environment-specific
   values (image digests) live in the pipeline rather than the param files.

---

## 7. Follow-ups

- [ ] Merge PR #69.
- [ ] Converge **production** identically (`converge-acr-pull-assignments.sh production --apply` +
      module re-`PUT`) as part of the promotion. *(Deferred until #69 merges.)*
- [ ] Run the production full deploy via CI (correct image digests) to reconcile drift, then verify
      schema + admin login per the deploy handoff.
- [ ] (Optional hardening) Add a lint/review check enforcing the role-assignment name-seed convention.
