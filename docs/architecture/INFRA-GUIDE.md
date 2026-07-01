# Allarounder — Infrastructure & CI/CD Provisioning Guide

**Audience:** Guido (the developer)  
**Scope:** One-time Azure setup + GitHub wiring to get the full CI/CD pipeline live. Run this once per environment (staging first, then production). Day-2 operations are at the end.  
**Related:** `TECH-SPEC.md §6–7`, `adr/ADR-0012.md` (CI/CD strategy), `adr/ADR-0013.md` (security), `../../infra/`

---

## Prerequisites

Install these once on your machine.

```bash
# Azure CLI (includes az bicep via `az bicep install`)
winget install Microsoft.AzureCLI        # Windows
# brew install azure-cli                 # macOS

# Upgrade Bicep CLI to latest
az bicep install

# GitHub CLI (for environment and secret management)
winget install GitHub.cli

# psql (for the post-provisioning Postgres identity step)
winget install PostgreSQL.PostgreSQL     # or use the one inside Docker

# openssl (for generating JWT signing key — ships with Git Bash / WSL)
```

Verify:

```bash
az version               # ≥ 2.60
az bicep version         # ≥ 0.28
gh --version             # ≥ 2.50
psql --version           # any 15+
```

---

## Overview of identities

Two categories of managed identity are used — keep them separate in your head:

| Identity | Created by | Used for |
|---|---|---|
| `allarounder-ci-build` | You (step 2) | GitHub Actions → push images to ACR |
| `allarounder-ci-staging` | You (step 2) | GitHub Actions → deploy to staging Container Apps, run migration job |
| `allarounder-ci-production` | You (step 2) | GitHub Actions → deploy to production Container Apps |
| `allarounder-staging-backend-id` | Bicep | Backend Container App → Postgres, Blob Storage, Key Vault at runtime |
| `allarounder-staging-frontend-id` | Bicep | Frontend Container App → ACR pull at runtime |
| `allarounder-production-backend-id` | Bicep | Same as above for production |
| `allarounder-production-frontend-id` | Bicep | Same |

The CI identities authenticate GitHub Actions to Azure. The runtime identities run inside the Container Apps themselves. They are never mixed.

---

## Step 1 — Azure login and subscription

```bash
az login
az account set --subscription "<your-subscription-id>"

# Verify you're in the right place
az account show --query "{name:name, id:id}" -o table
```

---

## Step 2 — Resource groups and CI managed identities

Run this block once to create both environments' resource groups and the three CI identities.

```bash
LOCATION="italynorth"

# Resource groups
az group create --name allarounder-staging    --location $LOCATION
az group create --name allarounder-production --location $LOCATION

# CI managed identities (user-assigned, federated with GitHub Actions OIDC)
az identity create --name allarounder-ci-build      --resource-group allarounder-staging
az identity create --name allarounder-ci-staging    --resource-group allarounder-staging
az identity create --name allarounder-ci-production --resource-group allarounder-production
```

### 2a — Role assignments for CI identities

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Build identity: push images to ACR.
# ACR doesn't exist yet — grant at subscription scope so it works after Bicep creates it,
# or scope to the staging RG (ACR lives there).
BUILD_PRINCIPAL=$(az identity show --name allarounder-ci-build \
  --resource-group allarounder-staging --query principalId -o tsv)

az role assignment create \
  --assignee "$BUILD_PRINCIPAL" \
  --role "AcrPush" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/allarounder-staging"

# Staging identity: full Contributor on staging RG (runs containerapp update, job start, etc.)
STAGING_PRINCIPAL=$(az identity show --name allarounder-ci-staging \
  --resource-group allarounder-staging --query principalId -o tsv)

az role assignment create \
  --assignee "$STAGING_PRINCIPAL" \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/allarounder-staging"

# Production identity: Contributor on production RG
PROD_PRINCIPAL=$(az identity show --name allarounder-ci-production \
  --resource-group allarounder-production --query principalId -o tsv)

az role assignment create \
  --assignee "$PROD_PRINCIPAL" \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/allarounder-production"
```

### 2b — OIDC federated credentials

This is what lets GitHub Actions prove its identity to Azure without storing any secrets.

```bash
REPO="gweedo/allarounder"
ISSUER="https://token.actions.githubusercontent.com"
AUDIENCE="api://AzureADTokenExchange"

# Build identity: trusted on pushes to main (for image build/push)
az identity federated-credential create \
  --identity-name allarounder-ci-build \
  --resource-group allarounder-staging \
  --name github-main-push \
  --issuer "$ISSUER" \
  --subject "repo:${REPO}:ref:refs/heads/main" \
  --audiences "$AUDIENCE"

# Staging identity: trusted when the 'staging' GitHub Environment is active
az identity federated-credential create \
  --identity-name allarounder-ci-staging \
  --resource-group allarounder-staging \
  --name github-staging-env \
  --issuer "$ISSUER" \
  --subject "repo:${REPO}:environment:staging" \
  --audiences "$AUDIENCE"

# Production identity: trusted when the 'production' GitHub Environment is active
az identity federated-credential create \
  --identity-name allarounder-ci-production \
  --resource-group allarounder-production \
  --name github-production-env \
  --issuer "$ISSUER" \
  --subject "repo:${REPO}:environment:production" \
  --audiences "$AUDIENCE"
```

### 2c — Collect the values you'll need later

```bash
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

BUILD_CLIENT_ID=$(az identity show --name allarounder-ci-build \
  --resource-group allarounder-staging --query clientId -o tsv)
STAGING_CLIENT_ID=$(az identity show --name allarounder-ci-staging \
  --resource-group allarounder-staging --query clientId -o tsv)
PROD_CLIENT_ID=$(az identity show --name allarounder-ci-production \
  --resource-group allarounder-production --query clientId -o tsv)

# Also needed for Postgres Entra admin in the parameter files:
STAGING_SP_OID=$(az identity show --name allarounder-ci-staging \
  --resource-group allarounder-staging --query principalId -o tsv)
PROD_SP_OID=$(az identity show --name allarounder-ci-production \
  --resource-group allarounder-production --query principalId -o tsv)

echo "TENANT_ID=$TENANT_ID"
echo "SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
echo "BUILD_CLIENT_ID=$BUILD_CLIENT_ID"
echo "STAGING_CLIENT_ID=$STAGING_CLIENT_ID"
echo "PROD_CLIENT_ID=$PROD_CLIENT_ID"
echo "STAGING_SP_OID=$STAGING_SP_OID"
echo "PROD_SP_OID=$PROD_SP_OID"
```

Keep these values handy — you paste them into the parameter files and GitHub secrets in the next steps.

---

## Step 3 — Fill in the parameter files

### 3a — Generate unique suffixes

Azure requires globally unique names for ACR, Key Vault, Storage, and PostgreSQL. Derive a deterministic 5-character suffix from each resource group ID:

```bash
STAGING_SUFFIX=$(az group show --name allarounder-staging \
  --query id -o tsv | md5sum | head -c 5)
PROD_SUFFIX=$(az group show --name allarounder-production \
  --query id -o tsv | md5sum | head -c 5)

echo "Staging suffix : $STAGING_SUFFIX"
echo "Production suffix: $PROD_SUFFIX"
```

### 3b — Edit `infra/parameters/staging.bicepparam`

Replace every `<suffix>` with `$STAGING_SUFFIX` and fill in the object ID:

```
param keyVaultName        = 'alla-stg-kv-<suffix>'       → 'alla-stg-kv-a1b2c'
param postgresServerName  = 'allarounder-stg-pg-<suffix>' → 'allarounder-stg-pg-a1b2c'
param storageAccountName  = 'allastg<suffix>'             → 'allastga1b2c'
param postgresEntraAdminObjectId = '<github-ci-sp-object-id>' → '$STAGING_SP_OID'
```

### 3c — Edit `infra/parameters/production.bicepparam`

Same exercise with `$PROD_SUFFIX` and `$PROD_SP_OID`. The `acrName` stays `allarounderstgacr` (production reuses the staging ACR, so `deployAcr = false`).

---

## Step 4 — Deploy the Bicep template (staging)

```bash
az deployment group create \
  --name "allarounder-staging-$(date +%Y%m%d-%H%M)" \
  --resource-group allarounder-staging \
  --template-file infra/main.bicep \
  --parameters infra/parameters/staging.bicepparam \
  --verbose
```

Expected duration: **8–12 minutes** (PostgreSQL provisioning takes the longest).

If it fails partway, Bicep is idempotent — re-run the same command after fixing the error.

### Verify the deployment

```bash
# List outputs (FQDN of the frontend Container App, etc.)
az deployment group show \
  --name "allarounder-staging-<date>" \
  --resource-group allarounder-staging \
  --query properties.outputs \
  -o table
```

---

## Step 5 — Post-provisioning: grant backend managed identity PostgreSQL access

Bicep provisions the Postgres server with Entra-only auth, but it cannot create a PostgreSQL role for the backend managed identity — that requires a SQL statement run as the Entra admin. Run the included script:

```bash
# You must be logged in as the Entra PostgreSQL admin (the same session as az login above)
./infra/scripts/create-postgres-identity.sh staging allarounder-stg-pg-a1b2c
```

The script connects to Postgres as your user, creates the managed identity as a PostgreSQL role, and grants it full access to the `allarounder` database. It prints the exact `DATABASE_URL` the backend will use.

> **Why?** Azure's Entra integration for PostgreSQL works by creating a PostgreSQL role whose name is the managed identity's display name and whose authentication is handled via Entra token. This is a psql-level operation — no Azure portal or Bicep equivalent exists.

---

## Step 6 — Add the JWT signing key to Key Vault

The backend reads this secret via the Key Vault reference in the Container App configuration. Bicep wires the reference; you supply the value:

```bash
# Generate a cryptographically strong key
JWT_SECRET=$(openssl rand -base64 48)

# Store in staging Key Vault
KV_NAME=$(az keyvault list --resource-group allarounder-staging \
  --query "[0].name" -o tsv)

az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name jwt-signing-key \
  --value "$JWT_SECRET"

echo "JWT secret stored in $KV_NAME"
```

> The secret value is printed to your terminal once — save it in a password manager if you ever need to rotate it manually. After this step the value never leaves Key Vault.

---

## Step 7 — GitHub Actions setup

### 7a — Create GitHub Environments with protection rules

```bash
# The 'staging' environment: no approval gate — deploys automatically on merge to main
gh api repos/gweedo/allarounder/environments/staging \
  --method PUT \
  --field wait_timer=0

# The 'production' environment: require a manual review before any deploy
gh api repos/gweedo/allarounder/environments/production \
  --method PUT \
  --input - <<'EOF'
{
  "wait_timer": 0,
  "reviewers": [{"type": "User", "id": "<your-github-user-id>"}],
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF

# Restrict production deploys to main only
gh api repos/gweedo/allarounder/environments/production/deployment-branch-policies \
  --method POST \
  --field name=main \
  --field type=branch
```

To find your GitHub user ID: `gh api user --jq .id`

### 7b — Repository-level secrets (shared between environments)

```bash
# These are the same for both environments
gh secret set AZURE_TENANT_ID       --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID"
gh secret set AZURE_CLIENT_ID_BUILD --body "$BUILD_CLIENT_ID"
gh secret set ACR_NAME              --body "allarounderstgacr"
gh secret set ACR_LOGIN_SERVER      --body "allarounderstgacr.azurecr.io"
```

### 7c — Staging environment secrets and variables

```bash
# Secrets: sensitive values
gh secret set AZURE_CLIENT_ID --env staging --body "$STAGING_CLIENT_ID"

# Variables: non-sensitive config the workflow reads
STG_BACKEND_APP=$(az deployment group show \
  --name "allarounder-staging-<date>" \
  --resource-group allarounder-staging \
  --query "properties.outputs.backendAppName.value" -o tsv)

STG_FRONTEND_APP=$(az deployment group show \
  --name "allarounder-staging-<date>" \
  --resource-group allarounder-staging \
  --query "properties.outputs.frontendAppName.value" -o tsv)

STG_MIGRATE_JOB=$(az deployment group show \
  --name "allarounder-staging-<date>" \
  --resource-group allarounder-staging \
  --query "properties.outputs.migrationJobName.value" -o tsv)

STG_FRONTEND_FQDN=$(az deployment group show \
  --name "allarounder-staging-<date>" \
  --resource-group allarounder-staging \
  --query "properties.outputs.frontendFqdn.value" -o tsv)

gh variable set RESOURCE_GROUP      --env staging --body "allarounder-staging"
gh variable set BACKEND_APP_NAME    --env staging --body "$STG_BACKEND_APP"
gh variable set FRONTEND_APP_NAME   --env staging --body "$STG_FRONTEND_APP"
gh variable set MIGRATION_JOB_NAME  --env staging --body "$STG_MIGRATE_JOB"
gh variable set STAGING_URL         --env staging --body "https://${STG_FRONTEND_FQDN}"

# Required by the postgres-staging.yml stop/start workflow and by
# deploy-staging's pre-migration readiness check (see Day-2 § Staging
# PostgreSQL stop/start). Set this before the next staging deploy runs.
gh variable set POSTGRES_SERVER_NAME --env staging --body "allarounder-stg-pg-fc2a7"
```

### 7d — Production environment secrets and variables

Deploy production Bicep first (step 8 below), then come back here.

```bash
gh secret set AZURE_CLIENT_ID --env production --body "$PROD_CLIENT_ID"

# Fill in after production Bicep deploy
gh variable set RESOURCE_GROUP      --env production --body "allarounder-production"
gh variable set BACKEND_APP_NAME    --env production --body "allarounder-production-backend"
gh variable set FRONTEND_APP_NAME   --env production --body "allarounder-production-frontend"
gh variable set MIGRATION_JOB_NAME  --env production --body "allarounder-production-migrate"
```

---

## Step 8 — Deploy production Bicep

```bash
az deployment group create \
  --name "allarounder-production-$(date +%Y%m%d-%H%M)" \
  --resource-group allarounder-production \
  --template-file infra/main.bicep \
  --parameters infra/parameters/production.bicepparam \
  --verbose
```

Then run the Postgres identity script for production:

```bash
./infra/scripts/create-postgres-identity.sh production allarounder-prd-pg-a1b2c
```

Add the JWT key to the production Key Vault:

```bash
PROD_JWT_SECRET=$(openssl rand -base64 48)   # use a DIFFERENT key from staging
PROD_KV_NAME=$(az keyvault list --resource-group allarounder-production \
  --query "[0].name" -o tsv)

az keyvault secret set \
  --vault-name "$PROD_KV_NAME" \
  --name jwt-signing-key \
  --value "$PROD_JWT_SECRET"
```

Then come back and set the production GitHub variables (step 7d).

---

## Step 9 — First real deploy (trigger CI)

Push any change to `src/backend/**` or `src/frontend/**` on main to trigger the pipeline:

```bash
git checkout -b feat/first-deploy
echo "# First deploy" >> src/backend/README.md
git add src/backend/README.md
git commit -m "chore: trigger first CI/CD deploy"
git push -u origin feat/first-deploy
gh pr create --title "First deploy" --body "Triggers the full CI/CD pipeline"
gh pr merge --squash
```

### What to watch

```
GitHub → Actions → Backend CI/CD → (watch each job in order)

lint-and-typecheck ✓
test              ✓
security          ✓   ← pip-audit, gitleaks, CodeQL run here
build             ✓   ← image pushed to ACR; Trivy scans it
deploy-staging    ✓   ← migrations run first; then blue-green deploy
smoke-staging     ✓   ← /api/health + /api/v1/articles checked
deploy-production ⏸   ← paused; waiting for your manual approval
```

To approve the production deploy:

```bash
# In the GitHub Actions UI: click "Review deployments" → approve
# Or via CLI:
gh run list --workflow backend.yml --limit 1  # get the run ID
gh run review <run-id> --approve
```

---

## Step 10 — Custom domains and DNS

After the first successful deploy, wire the real domains.

### 10a — Get the Front Door CNAME

Since ADR-0016, **staging does not run Front Door** (`enableFrontDoor = false` in `staging.bicepparam`) — it's reached directly on its Container App FQDN. Only production has a Front Door profile to query:

```bash
az afd endpoint show \
  --profile-name "allarounder-production-afd" \
  --resource-group allarounder-production \
  --endpoint-name "allarounder-production" \
  --query "hostName" -o tsv
# → allarounder-production.azurefd.net
```

### 10b — Add DNS records at your registrar

For `allarounder.it`:
```
CNAME  @       allarounder-production.azurefd.net
CNAME  cdn     allarounder-production.azurefd.net
TXT    _dnsauth.<host>   <value shown in Azure portal custom domain tab>
```

For `allarounder.eu`:
```
CNAME  @       allarounder-production.azurefd.net
TXT    _dnsauth.<host>   <value shown in Azure portal custom domain tab>
```

The TXT record is required by Azure for domain ownership verification. Front Door issues a managed TLS certificate automatically once the record is in place. This takes **5–30 minutes**.

### 10c — Verify HSTS

```bash
curl -I https://allarounder.it/ | grep -i strict
# → Strict-Transport-Security: max-age=31536000; includeSubDomains

# Verify .eu redirect
curl -I https://allarounder.eu/ | grep -i location
# → Location: https://allarounder.it/
```

---

## Day-2 operations

### Bootstrap the first admin user

After the first successful deploy to an environment, the database contains no users. Run the bootstrap CLI from inside the backend container using `az containerapp exec`. The CLI prompts for the password interactively — it is never echoed to the terminal and never appears in shell history, `az` activity logs, or the container process list.

```bash
# Staging
az containerapp exec \
  --name allarounder-staging-backend \
  --resource-group allarounder-staging \
  --command "python -m cli create-admin --email <your-email>"
# Password: ▌  ← type here, input is hidden

# Production (repeat after the production deploy is approved)
az containerapp exec \
  --name allarounder-production-backend \
  --resource-group allarounder-production \
  --command "python -m cli create-admin --email <your-email>"
```

**Password requirements** (enforced by the domain policy):
- Minimum 12 characters
- Must not appear in the HaveIBeenPwned breached-passwords database

The CLI uses `get_engine()` internally, so it inherits the Entra token injection — no database password needs to be supplied.

Running the command a second time with the same email raises an error and leaves the existing user unchanged.

---

### Rolling back a deploy

Container Apps keeps old revisions warm. Instant rollback:

```bash
ENV=staging  # or production
RG=allarounder-${ENV}
APP=allarounder-${ENV}-backend

# List active revisions (most recent first)
az containerapp revision list --name "$APP" --resource-group "$RG" \
  --query "sort_by([?properties.active], &properties.lastActiveTime)[-2:].[name, properties.trafficWeight]" \
  -o table

# Roll back: point 100% traffic to the previous revision
PREVIOUS_REVISION="<name-of-previous-revision>"
az containerapp ingress traffic set \
  --name "$APP" --resource-group "$RG" \
  --revision-weight "${PREVIOUS_REVISION}=100"
```

Do the same for the frontend app. Total rollback time: **under 30 seconds**.

### WAF rules (Front Door Standard)

Front Door runs on the **Standard** tier (see [ADR-0015](adr/0015-front-door-standard-tier.md)). Standard supports **custom WAF rules only** — the active control is the custom per-IP volumetric rate-limit rule (`RateLimitPerIp`, 1,000 req/min, Block), which runs in Prevention mode from day one. There is no managed rule set and no Detection→Prevention burn-in to perform.

Microsoft-managed rule sets (`Microsoft_DefaultRuleSet`) and bot protection require the **Premium** tier and are intentionally not provisioned. If edge logs later show application-layer attack traffic the app controls don't catch, upgrade is a one-line SKU revert (`Standard_AzureFrontDoor` → `Premium_AzureFrontDoor` on both the profile and the WAF policy) plus re-adding a `managedRules` block — a non-breaking upgrade.

### Scaling Container Apps

The apps auto-scale HTTP-based between `minReplicas` and 5 replicas. `minReplicas` is parameterized per environment (`infra/parameters/*.bicepparam`): staging scales to **0** (tolerates a cold start after idle), production stays at **1** (no cold starts for visitors). To adjust ad hoc:

```bash
az containerapp update \
  --name allarounder-production-backend \
  --resource-group allarounder-production \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-scaling \
  --scale-rule-type http \
  --scale-rule-http-concurrency 30
```

### Staging PostgreSQL stop/start

Staging's PostgreSQL Flexible Server is stopped nightly to cut idle compute cost (~$13/mo — the `Standard_B1ms` compute charge). Stopping pauses compute billing only; storage and data are retained. This never applies to production.

- **Scheduled stop**: `.github/workflows/postgres-staging.yml` runs on a nightly cron (`0 22 * * *`, 22:00 UTC) and stops the server if it's `Ready`. Because Azure auto-restarts a server that's been stopped for ~7 days, the workflow re-applies the stop every night rather than relying on a one-off stop — the schedule itself is the mechanism that outlasts the auto-restart.
- **Automatic start on deploy**: `deploy-staging` in `backend.yml` runs an "Ensure PostgreSQL is running" step before the Alembic migration job — it starts the server if `Stopped` and polls until `Ready`, so a deploy against a stopped server just costs a couple of extra minutes rather than failing.
- **Manual start/stop**: trigger `postgres-staging.yml` via `workflow_dispatch` with `action: start` or `action: stop` (GitHub Actions UI or `gh workflow run postgres-staging.yml -f action=start`) — useful when working against staging outside of a deploy (e.g. `psql` access, manual query debugging).
- **Both paths are OIDC-authenticated** via the `staging` GitHub Environment's federated credential — no long-lived secrets. The job is hardcoded to `environment: staging`, so it can never resolve production's credentials or resource names.
- **Caveat**: the nightly stop only pauses compute for the idle window (deploy-time → 22:00 UTC), so days with a deploy realize less than the full ~$13/mo saving. This is acceptable for a solo-dev staging environment; use the manual `stop` dispatch if you want to pause it immediately after a work session.
- **Caveat**: `postgres-staging.yml` and `backend.yml` don't share a concurrency group, so a deploy that happens to be mid-migration at 22:00 UTC could race the nightly stop. This is rare (needs a deploy running at exactly that hour), staging-only, and re-runnable — not worth a cross-workflow lock, but worth knowing about if a staging deploy ever fails with the Postgres server unexpectedly `Stopping`.

Requires the `POSTGRES_SERVER_NAME` variable in the `staging` GitHub Environment (see step 7c).

### Rotating the JWT signing key

1. Generate a new key: `openssl rand -base64 48`
2. Set the new version in Key Vault: `az keyvault secret set --vault-name ... --name jwt-signing-key --value <new>`
3. Container Apps picks up the new secret on next restart. Force a restart:
   ```bash
   az containerapp revision restart \
     --name allarounder-production-backend \
     --resource-group allarounder-production \
     --revision <current-revision>
   ```
4. All existing refresh tokens remain valid until their 14-day expiry; access tokens expire within 30 minutes.

### Viewing logs

```bash
# Live log stream from the backend
az containerapp logs show \
  --name allarounder-production-backend \
  --resource-group allarounder-production \
  --follow

# Or query Log Analytics directly
az monitor log-analytics query \
  --workspace allarounder-production-logs \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == 'allarounder-production-backend' | order by TimeGenerated desc | limit 50" \
  -o table
```

Application Insights traces are available at:  
**Azure Portal → Application Insights → allarounder-production-insights → Live Metrics / Transaction Search**

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Bicep fails on PostgreSQL admin step | The Entra admin OID doesn't exist | Re-check `postgresEntraAdminObjectId` in the parameter file |
| `az login` fails in workflow | OIDC federated credential subject doesn't match | Verify the `--subject` includes the correct environment name |
| Backend starts but returns 500 | `jwt-signing-key` secret not in Key Vault yet | Run step 6 |
| Backend can't connect to Postgres | Managed identity not granted PostgreSQL role | Re-run `create-postgres-identity.sh` |
| Admin login returns 401 on first deploy | No admin user exists yet | Run the bootstrap CLI (see Day-2 § Bootstrap the first admin user) |
| Trivy scan blocks the build | High/critical CVE in base image | Rebuild `FROM python:3.12-slim` after `docker pull python:3.12-slim` picks up a patched layer; or add to `.trivyignore` if confirmed false positive |
| Front Door returns 421 on custom domain | DNS CNAME not propagated / TXT verification pending | Wait 30 min; check with `dig CNAME allarounder.it` |
| WAF blocks legitimate traffic | Custom rate-limit threshold too low | Check `RateLimitPerIp` hits in Front Door logs; raise `rateLimitThreshold` in `frontdoor.bicep` |

---

## Reference: all secrets and variables at a glance

### Repository secrets (all environments)

| Secret | Value |
|---|---|
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_CLIENT_ID_BUILD` | Client ID of `allarounder-ci-build` identity |
| `ACR_NAME` | `allarounderstgacr` |
| `ACR_LOGIN_SERVER` | `allarounderstgacr.azurecr.io` |

### Staging environment

| Secret / Variable | Value |
|---|---|
| Secret: `AZURE_CLIENT_ID` | Client ID of `allarounder-ci-staging` |
| Var: `RESOURCE_GROUP` | `allarounder-staging` |
| Var: `BACKEND_APP_NAME` | `allarounder-staging-backend` |
| Var: `FRONTEND_APP_NAME` | `allarounder-staging-frontend` |
| Var: `MIGRATION_JOB_NAME` | `allarounder-staging-migrate` |
| Var: `STAGING_URL` | `https://<frontend-fqdn>` from Bicep output |
| Var: `POSTGRES_SERVER_NAME` | `allarounder-stg-pg-fc2a7` (used by `postgres-staging.yml` and `deploy-staging`) |

### Production environment

| Secret / Variable | Value |
|---|---|
| Secret: `AZURE_CLIENT_ID` | Client ID of `allarounder-ci-production` |
| Var: `RESOURCE_GROUP` | `allarounder-production` |
| Var: `BACKEND_APP_NAME` | `allarounder-production-backend` |
| Var: `FRONTEND_APP_NAME` | `allarounder-production-frontend` |
| Var: `MIGRATION_JOB_NAME` | `allarounder-production-migrate` |
