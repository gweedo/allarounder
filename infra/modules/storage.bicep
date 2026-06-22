param location string
param storageAccountName string
param containerName string = 'images'
@description('Principal ID of the backend managed identity. When provided, grants Storage Blob Delegator so the backend can issue User Delegation SAS tokens.')
param backendIdentityPrincipalId string = ''

// Storage Blob Delegator — lets the identity call GetUserDelegationKey
var storageBlobDelegatorRoleId = 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

resource blobDelegatorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(backendIdentityPrincipalId)) {
  name: guid(storageAccount.id, backendIdentityPrincipalId, storageBlobDelegatorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDelegatorRoleId)
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output containerName string = imagesContainer.name
