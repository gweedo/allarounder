# Infrastructure (Bicep)

Azure infrastructure-as-code for Allarounder.

Bicep templates will be added here in issue #16 (Azure infra + CI/CD).

## Planned resources

- Azure Container Apps (backend + frontend)
- Azure Database for PostgreSQL Flexible Server
- Azure Blob Storage (private container, images)
- Azure Front Door (TLS, WAF, allarounder.eu → .it 301, HSTS, CDN)
- Azure Key Vault (JWT signing key only)
- Azure Container Registry
- Azure Monitor / Application Insights + Log Analytics

## Environments

Both staging and production are stamped from the same parameterised Bicep template.
