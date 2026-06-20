using '../main.bicep'

param env = 'staging'
param location = 'italynorth'

// ACR name: alphanumeric, globally unique, 5-50 chars
param acrName = 'allarounderstgacr'
param deployAcr = true

// Key Vault name: 3-24 chars, globally unique
// Update <suffix> with the last 5 chars of your resource group ID for uniqueness
param keyVaultName = 'alla-stg-kv-<suffix>'

// PostgreSQL server name: globally unique, lowercase alphanumeric and hyphens
param postgresServerName = 'allarounder-stg-pg-<suffix>'

// Storage account: 3-24 chars, lowercase alphanumeric, globally unique
param storageAccountName = 'allastg<suffix>'

// Entra admin for PostgreSQL — set to the Object ID of the GitHub CI service principal
// az ad sp show --id <client-id> --query id -o tsv
param postgresEntraAdminObjectId = '<github-ci-sp-object-id>'
param postgresEntraAdminName = 'allarounder-ci-stg'

// Images: updated by CI/CD on each deploy; use placeholder for first provision
param backendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param frontendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

param canonicalDomain = 'allarounder.it'
param redirectDomain = 'allarounder.eu'
param cdnBaseUrl = 'https://cdn.allarounder.it/images'
param corsAllowedOrigins = 'https://allarounder.it,https://www.allarounder.it'
