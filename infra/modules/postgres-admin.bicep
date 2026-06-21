param serverName string
param entraAdminObjectId string
param entraAdminName string

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: serverName
}

resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: postgres
  name: entraAdminObjectId
  properties: {
    principalType: 'ServicePrincipal'
    principalName: entraAdminName
    tenantId: subscription().tenantId
  }
}
