param location string
param serverName string
param databaseName string = 'allarounder'
param entraAdminName string
param entraAdminObjectId string
param skuName string = 'Standard_B1ms'
param skuTier string = 'Burstable'
param storageSizeGB int = 32
param backupRetentionDays int = 7

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: '16'
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: subscription().tenantId
    }
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Entra admin for the PostgreSQL server (service principal used by CI/CD and admins)
resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: postgres
  name: entraAdminObjectId
  properties: {
    principalType: 'ServicePrincipal'
    principalName: entraAdminName
    tenantId: subscription().tenantId
  }
}

// Allow all Azure-internal IPs (Container Apps reach the server through Azure backbone)
resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output postgresHost string = postgres.properties.fullyQualifiedDomainName
output postgresName string = postgres.name
output databaseName string = database.name
