using '../main.bicep'

param env = 'staging'
param location = 'italynorth'

// ACR name: alphanumeric, globally unique, 5-50 chars
param acrName = 'allarounderstgacr'
param deployAcr = true

// Key Vault name: 3-24 chars, globally unique
// Update <suffix> with the last 5 chars of your resource group ID for uniqueness
param keyVaultName = 'alla-stg-kv-fc2a7'

// PostgreSQL server name: globally unique, lowercase alphanumeric and hyphens
param postgresServerName = 'allarounder-stg-pg-fc2a7'

// Storage account: 3-24 chars, lowercase alphanumeric, globally unique
param storageAccountName = 'allastgfc2a7'

// Entra admin for PostgreSQL — set to the Object ID of the GitHub CI service principal
// az ad sp show --id <client-id> --query id -o tsv
param postgresEntraAdminObjectId = 'fabc8249-dce9-4d86-a12b-48a67539a9f2'
param postgresEntraAdminName = 'allarounder-ci-stg'

// Images: updated by CI/CD on each deploy; use placeholder for first provision
param backendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param frontendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

param canonicalDomain = 'allarounder.it'
param redirectDomain = 'allarounder.eu'
param cdnBaseUrl = 'https://cdn.allarounder.it/images'
param corsAllowedOrigins = 'https://allarounder.it,https://www.allarounder.it'

// Front Door is a production concern (custom domain TLS, .eu redirect, rate-limit WAF).
// Staging is reached directly on the frontend Container App's *.azurecontainerapps.io FQDN.
param enableFrontDoor = false

// Scale to zero when idle — staging tolerates a cold start on the first request
// after a period of no traffic (~$25-40/mo saved vs. an always-on replica per app).
param minReplicas = 0

// Post-optimization staging idles well under $20/mo (no Front Door, scale-to-zero,
// Postgres paused nightly); $30 leaves headroom while still catching a regression.
param budgetAmount = 30
