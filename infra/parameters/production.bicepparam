using '../main.bicep'

param env = 'production'
param location = 'italynorth'

// Reuse the ACR from staging (no rebuild — same digest promoted to production)
param acrName = 'allarounderstgacr'
param deployAcr = false

// Key Vault name: separate vault for production secrets
param keyVaultName = 'alla-prd-kv-<suffix>'

// Separate PostgreSQL server for production
param postgresServerName = 'allarounder-prd-pg-<suffix>'

// Separate storage account for production
param storageAccountName = 'allaprd<suffix>'

// Entra admin for PostgreSQL — use a dedicated production service principal
param postgresEntraAdminObjectId = '<github-ci-prod-sp-object-id>'
param postgresEntraAdminName = 'allarounder-ci-prd'

// Images: updated by CI/CD on each deploy (same digest as staging — no rebuild)
param backendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param frontendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

param canonicalDomain = 'allarounder.it'
param redirectDomain = 'allarounder.eu'
param cdnBaseUrl = 'https://cdn.allarounder.it/images'
param corsAllowedOrigins = 'https://allarounder.it,https://www.allarounder.it'
