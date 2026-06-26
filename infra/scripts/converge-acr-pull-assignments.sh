#!/usr/bin/env bash
# Run ONCE per environment to remove stale AcrPull role assignments so that a
# full Bicep deploy can re-create them under the module's deterministic name
# without failing on `RoleAssignmentExists`.
#
# Why this is needed:
#   The original grant (in container-apps.bicep) named the assignment
#       guid(acrId, <identity>.id, acrPullRoleId)      <- keyed on the identity *resource ID*
#   The current module (acr-pull-assignments.bicep) names it
#       guid(acrRef.id, <principalId>, acrPullRoleId)  <- keyed on the *principal GUID*
#   Both are deterministic, but they differ, so the still-present old-formula
#   assignment blocks the new one: ARM forbids a second AcrPull assignment for
#   the same principal + scope under a different name.
#
#   Deleting the stale assignment lets the next `az deployment group create`
#   create it under the deterministic name. From then on the name is stable and
#   every redeploy is an idempotent no-op — Bicep stays the source of truth.
#
# Usage:
#   ./infra/scripts/converge-acr-pull-assignments.sh <env>            # dry-run (prints what it WOULD delete)
#   ./infra/scripts/converge-acr-pull-assignments.sh <env> --apply    # actually delete
#
#   <env> is staging | production
#
# Prerequisites:
#   - az login as a user with Microsoft.Authorization/roleAssignments/delete on the ACR
#   - The ACR is shared and lives in the staging resource group (see *.bicepparam)
#
# After running with --apply, run the full Bicep deploy for <env>; it recreates
# the assignments under the deterministic name.

set -euo pipefail

ENV="${1:?Usage: $0 <staging|production> [--apply]}"
MODE="${2:-dry-run}"

# The ACR is shared across environments; both bicepparam files point at the
# staging resource group. Keep these in sync with infra/parameters/*.bicepparam.
ACR_NAME="allarounderstgacr"
ACR_RESOURCE_GROUP="allarounder-staging"
ACR_PULL_ROLE="AcrPull"

case "$ENV" in
  staging|production) ;;
  *) echo "ERROR: env must be 'staging' or 'production' (got '$ENV')" >&2; exit 1 ;;
esac

if [[ "$MODE" != "dry-run" && "$MODE" != "--apply" ]]; then
  echo "ERROR: second arg must be omitted (dry-run) or '--apply' (got '$MODE')" >&2
  exit 1
fi

IDENTITY_RG="allarounder-${ENV}"
BACKEND_IDENTITY="allarounder-${ENV}-backend-id"
FRONTEND_IDENTITY="allarounder-${ENV}-frontend-id"

echo "==> Resolving shared ACR scope..."
ACR_ID=$(az acr show -n "$ACR_NAME" -g "$ACR_RESOURCE_GROUP" --query id -o tsv)
echo "    ACR: ${ACR_ID}"

echo "==> Resolving ${ENV} managed-identity principals..."
delete_count=0
for IDENTITY in "$BACKEND_IDENTITY" "$FRONTEND_IDENTITY"; do
  PRINCIPAL_ID=$(az identity show --name "$IDENTITY" --resource-group "$IDENTITY_RG" --query principalId -o tsv)
  echo "    ${IDENTITY}: ${PRINCIPAL_ID}"

  # List every AcrPull assignment this principal holds directly on the ACR
  # resource. There should be exactly one; we delete it so Bicep can recreate it
  # by name. We match on the registry suffix rather than the full scope because
  # `az acr show` returns the id with `resourceGroups` while role-assignment
  # scopes come back lowercased — an exact `==` compare would silently miss them.
  # ends_with on the registry segment also excludes any inherited (RG/sub-scoped)
  # AcrPull grant, which we must not touch.
  mapfile -t ASSIGNMENT_NAMES < <(az role assignment list \
    --scope "$ACR_ID" \
    --assignee "$PRINCIPAL_ID" \
    --role "$ACR_PULL_ROLE" \
    --query "[?ends_with(scope, 'registries/${ACR_NAME}')].name" -o tsv)

  if [[ ${#ASSIGNMENT_NAMES[@]} -eq 0 ]]; then
    echo "      (no AcrPull assignment at ACR scope — nothing to converge)"
    continue
  fi

  for NAME in "${ASSIGNMENT_NAMES[@]}"; do
    if [[ "$MODE" == "--apply" ]]; then
      echo "      DELETING assignment ${NAME}"
      az role assignment delete --ids "${ACR_ID}/providers/Microsoft.Authorization/roleAssignments/${NAME}" --output none
      delete_count=$((delete_count + 1))
    else
      echo "      WOULD DELETE assignment ${NAME}  (re-run with --apply)"
    fi
  done
done

echo ""
if [[ "$MODE" == "--apply" ]]; then
  echo "==> Deleted ${delete_count} stale assignment(s)."
  echo "    Now run the full Bicep deploy for '${ENV}' — it recreates the AcrPull"
  echo "    assignments under the deterministic name. Subsequent deploys are no-ops."
else
  echo "==> Dry run only. Re-run with '--apply' to delete, then run the full Bicep deploy."
fi
