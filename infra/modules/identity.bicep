param env string
param location string

resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'allarounder-${env}-backend-id'
  location: location
}

resource frontendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'allarounder-${env}-frontend-id'
  location: location
}

output backendIdentityId string = backendIdentity.id
output backendIdentityName string = backendIdentity.name
output backendIdentityPrincipalId string = backendIdentity.properties.principalId
output backendIdentityClientId string = backendIdentity.properties.clientId
output frontendIdentityId string = frontendIdentity.id
output frontendIdentityName string = frontendIdentity.name
output frontendIdentityPrincipalId string = frontendIdentity.properties.principalId
