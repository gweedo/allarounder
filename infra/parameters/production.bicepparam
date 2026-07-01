using '../main.bicep'

param env = 'production'
param location = 'italynorth'

// Reuse the ACR from staging (no rebuild — same digest promoted to production)
param acrName = 'allarounderstgacr'
param deployAcr = false
param acrResourceGroup = 'allarounder-staging'

// Key Vault name: separate vault for production secrets
param keyVaultName = 'alla-prd-kv-32005'

// Separate PostgreSQL server for production
param postgresServerName = 'allarounder-prd-pg-32005'

// Separate storage account for production
param storageAccountName = 'allaprd32005'

// Entra admin for PostgreSQL — use a dedicated production service principal
param postgresEntraAdminObjectId = 'd7568542-b426-4aef-b5c4-390823fbf629'
param postgresEntraAdminName = 'allarounder-ci-prd'

// Images: updated by CI/CD on each deploy (same digest as staging — no rebuild)
param backendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param frontendImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

param canonicalDomain = 'allarounder.it'
param redirectDomain = 'allarounder.eu'
param cdnBaseUrl = 'https://cdn.allarounder.it/images'
param corsAllowedOrigins = 'https://allarounder.it,https://www.allarounder.it'

param enableFrontDoor = true

// Always-on — production visitors should never pay a cold-start penalty.
param minReplicas = 1
