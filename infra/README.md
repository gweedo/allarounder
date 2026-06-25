# Infrastructure (Bicep)

Azure infrastructure-as-code for Allarounder. See **[`docs/architecture/INFRA-GUIDE.md`](../docs/architecture/INFRA-GUIDE.md)** for the full step-by-step provisioning walkthrough.

## Quick reference

```bash
# Deploy staging (first time)
az deployment group create \
  --name "allarounder-staging-$(date +%Y%m%d)" \
  --resource-group allarounder-staging \
  --template-file infra/main.bicep \
  --parameters infra/parameters/staging.bicepparam

# Deploy production (after staging is verified)
az deployment group create \
  --name "allarounder-production-$(date +%Y%m%d)" \
  --resource-group allarounder-production \
  --template-file infra/main.bicep \
  --parameters infra/parameters/production.bicepparam
```

## Resources provisioned

| Module | Resources |
|---|---|
| `modules/monitoring.bicep` | Log Analytics workspace + Application Insights |
| `modules/acr.bicep` | Azure Container Registry (shared; staging creates it) |
| `modules/keyvault.bicep` | Key Vault (RBAC auth; holds JWT signing key only) |
| `modules/postgres.bicep` | PostgreSQL Flexible Server 16 (Entra-only auth, no password) |
| `modules/storage.bicep` | Blob Storage account + private `images` container |
| `modules/container-apps.bicep` | CAE + backend app + frontend app + migration job + managed identities + role assignments |
| `modules/frontdoor.bicep` | Front Door Standard + custom-rule WAF (rate limit) + HSTS rule + .eu→.it redirect + CDN route |

## Environments

Both `staging` and `production` are stamped from the same `main.bicep` with different parameter files. Production reuses the staging ACR (`deployAcr = false`) so the same image digest is promoted without a rebuild.

## Post-provisioning

After each first deploy, run:

```bash
# Grant backend managed identity a PostgreSQL role (cannot be done in Bicep)
./infra/scripts/create-postgres-identity.sh <env> <pg-server-name>

# Add the JWT signing key to Key Vault
az keyvault secret set --vault-name <kv-name> --name jwt-signing-key --value $(openssl rand -base64 48)
```
