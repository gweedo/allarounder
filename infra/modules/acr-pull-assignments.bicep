// Grants AcrPull to the backend and frontend managed identities on a given ACR.
// Deployed with scope: resourceGroup(acrResourceGroup) from main.bicep so it
// works whether the ACR is in the same RG (staging) or a different one (production).
//
// Idempotency: the role-assignment name is a deterministic guid(scope, principal,
// role). Re-deploying with the same inputs produces the same name, so ARM treats
// it as a no-op update — never a duplicate.
//
// One-time convergence: an earlier version of this grant (in container-apps.bicep)
// named the assignment guid(acrId, <identity>.id, role) — keyed on the identity
// *resource ID* rather than the *principal GUID* used below. Those old-formula
// assignments differ in name and block the new ones with `RoleAssignmentExists`.
// If a full deploy fails with that error, run once per environment:
//   ./infra/scripts/converge-acr-pull-assignments.sh <env> --apply
// then redeploy — it deletes the stale assignment so this module can own it.
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
