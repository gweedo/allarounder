// Allarounder — main infrastructure template
// Deploy with:
//   az deployment group create \
//     --resource-group allarounder-staging \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters/staging.bicepparam

@description('Environment name (staging or production)')
param env string

@description('Azure region for all resources')
param location string = 'italynorth'

@description('Azure Container Registry name (alphanumeric, globally unique)')
param acrName string

@description('Whether to deploy ACR (true for staging; false for production when reusing staging ACR)')
param deployAcr bool = true

@description('Resource group that holds the ACR when reusing an existing one (production reuses staging ACR)')
param acrResourceGroup string = 'allarounder-staging'

@description('Key Vault name (3-24 chars, globally unique)')
param keyVaultName string

@description('PostgreSQL server name (globally unique)')
param postgresServerName string

@description('Storage account name (3-24 chars, alphanumeric, globally unique)')
param storageAccountName string

@description('Object ID of the Entra service principal used as PostgreSQL admin (the GitHub CI identity)')
param postgresEntraAdminObjectId string

@description('Display name of the Entra PostgreSQL admin')
param postgresEntraAdminName string

@description('Current backend image to deploy (use placeholder on first deploy)')
param backendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Current frontend image to deploy (use placeholder on first deploy)')
param frontendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Canonical site domain (allarounder.it)')
param canonicalDomain string = 'allarounder.it'

@description('Redirect domain (allarounder.eu → canonicalDomain)')
param redirectDomain string = 'allarounder.eu'

@description('CDN base URL for image serving via Front Door')
param cdnBaseUrl string

@description('CORS allowed origins (comma-separated)')
param corsAllowedOrigins string

// ── Monitoring ───────────────────────────────────────────────────────────────

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    env: env
    location: location
  }
}

// ── Container Registry ────────────────────────────────────────────────────────

module acr './modules/acr.bicep' = if (deployAcr) {
  name: 'acr'
  params: {
    location: location
    acrName: acrName
  }
}

// When reusing the staging ACR in production, reference it as existing in its source RG
resource acrExisting 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = if (!deployAcr) {
  name: acrName
  scope: resourceGroup(acrResourceGroup)
}

var acrLoginServer = deployAcr ? acr!.outputs.acrLoginServer : acrExisting!.properties.loginServer

// ── Key Vault ─────────────────────────────────────────────────────────────────

module keyvault './modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    keyVaultName: keyVaultName
  }
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────

module postgres './modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location
    serverName: postgresServerName
    entraAdminObjectId: postgresEntraAdminObjectId
    entraAdminName: postgresEntraAdminName
  }
}

// ── Blob Storage ──────────────────────────────────────────────────────────────

module storage './modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    storageAccountName: storageAccountName
  }
}

// ── Container Apps ────────────────────────────────────────────────────────────

module containerApps './modules/container-apps.bicep' = {
  name: 'container-apps'
  params: {
    env: env
    location: location
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
    acrLoginServer: acrLoginServer
    storageAccountName: storage.outputs.storageAccountName
    storageContainerName: storage.outputs.containerName
    keyVaultUri: keyvault.outputs.keyVaultUri
    keyVaultId: keyvault.outputs.keyVaultId
    postgresHost: postgres.outputs.postgresHost
    databaseName: postgres.outputs.databaseName
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    backendImage: backendImage
    frontendImage: frontendImage
    corsAllowedOrigins: corsAllowedOrigins
    cdnBaseUrl: cdnBaseUrl
  }
}

// ── ACR pull role assignments (runs in ACR's RG to support cross-RG in production) ──

module acrPullAssignments './modules/acr-pull-assignments.bicep' = {
  name: 'acr-pull-assignments'
  scope: resourceGroup(acrResourceGroup)
  params: {
    acrName: acrName
    backendIdentityPrincipalId: containerApps.outputs.backendIdentityPrincipalId
    frontendIdentityPrincipalId: containerApps.outputs.frontendIdentityPrincipalId
  }
}

// ── Front Door ────────────────────────────────────────────────────────────────

module frontdoor './modules/frontdoor.bicep' = {
  name: 'frontdoor'
  params: {
    env: env
    frontendFqdn: containerApps.outputs.frontendFqdn
    storageAccountName: storage.outputs.storageAccountName
    storageContainerName: storage.outputs.containerName
    canonicalDomain: canonicalDomain
    redirectDomain: redirectDomain
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────

output acrLoginServer string = acrLoginServer
output backendAppName string = containerApps.outputs.backendAppName
output frontendAppName string = containerApps.outputs.frontendAppName
output migrationJobName string = containerApps.outputs.migrationJobName
output caeName string = containerApps.outputs.caeName
output backendFqdn string = containerApps.outputs.backendFqdn
output frontendFqdn string = containerApps.outputs.frontendFqdn
output frontDoorEndpoint string = frontdoor.outputs.frontDoorEndpointHostname
output keyVaultUri string = keyvault.outputs.keyVaultUri
output postgresHost string = postgres.outputs.postgresHost
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString
