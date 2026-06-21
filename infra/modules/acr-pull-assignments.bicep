// Grants AcrPull to the backend and frontend managed identities on a given ACR.
// Deployed with scope: resourceGroup(acrResourceGroup) from main.bicep so it
// works whether the ACR is in the same RG (staging) or a different one (production).
param acrName string
param backendIdentityPrincipalId string
param frontendIdentityPrincipalId string

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrRef 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrRef.id, backendIdentityPrincipalId, acrPullRoleId)
  scope: acrRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrRef.id, frontendIdentityPrincipalId, acrPullRoleId)
  scope: acrRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: frontendIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}
