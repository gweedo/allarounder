param env string
param location string
param logAnalyticsWorkspaceId string
param logAnalyticsCustomerId string
@secure()
param logAnalyticsSharedKey string
param acrLoginServer string
param acrId string
param storageAccountName string
param storageContainerName string
param keyVaultUri string
param keyVaultId string
param postgresHost string
param databaseName string
param appInsightsConnectionString string
param backendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param frontendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param corsAllowedOrigins string
param cdnBaseUrl string

// Built-in role IDs
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e0'

resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'allarounder-${env}-backend-id'
  location: location
}

resource frontendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'allarounder-${env}-frontend-id'
  location: location
}

// ACR pull rights for both apps
resource acrRef 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: last(split(acrId, '/'))
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrId, backendIdentity.id, acrPullRoleId)
  scope: acrRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: backendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrId, frontendIdentity.id, acrPullRoleId)
  scope: acrRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: frontendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Blob Storage access for backend
resource storageRef 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource backendBlobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageRef.id, backendIdentity.id, storageBlobDataContributorRoleId)
  scope: storageRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: backendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Key Vault access for backend (JWT signing key)
resource kvRef 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultId, '/'))
}

resource backendKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultId, backendIdentity.id, keyVaultSecretsUserRoleId)
  scope: kvRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: backendIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'allarounder-${env}-cae'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'allarounder-${env}-backend'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: false
        targetPort: 8000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: backendIdentity.id
        }
      ]
      secrets: [
        {
          name: 'jwt-signing-key'
          keyVaultUrl: '${keyVaultUri}secrets/jwt-signing-key'
          identity: backendIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'APP_ENV', value: env }
            { name: 'LOG_LEVEL', value: 'INFO' }
            { name: 'AZURE_USE_MANAGED_IDENTITY', value: 'true' }
            { name: 'AZURE_CLIENT_ID', value: backendIdentity.properties.clientId }
            {
              name: 'DATABASE_URL'
              value: 'postgresql+psycopg://${backendIdentity.name}@${postgresHost}/${databaseName}?sslmode=require'
            }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'AZURE_STORAGE_CONTAINER_NAME', value: storageContainerName }
            { name: 'AZURE_CDN_BASE_URL', value: cdnBaseUrl }
            { name: 'CORS_ALLOWED_ORIGINS', value: corsAllowedOrigins }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'JWT_SECRET_KEY', secretRef: 'jwt-signing-key' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 8000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [backendAcrPull, backendBlobAccess, backendKvAccess]
}

resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'allarounder-${env}-frontend'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${frontendIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: frontendIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'NEXT_PUBLIC_API_URL', value: 'https://${backendApp.properties.configuration.ingress.fqdn}' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/'
                port: 3000
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/'
                port: 3000
              }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [frontendAcrPull]
}

// One-off migration job run before each deployment
resource migrationJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'allarounder-${env}-migrate'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: cae.id
    workloadProfileName: 'Consumption'
    configuration: {
      replicaTimeout: 300
      replicaRetryLimit: 1
      triggerType: 'Manual'
      registries: [
        {
          server: acrLoginServer
          identity: backendIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: backendImage
          command: ['alembic', 'upgrade', 'head']
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'AZURE_USE_MANAGED_IDENTITY', value: 'true' }
            { name: 'AZURE_CLIENT_ID', value: backendIdentity.properties.clientId }
            {
              name: 'DATABASE_URL'
              value: 'postgresql+psycopg://${backendIdentity.name}@${postgresHost}/${databaseName}?sslmode=require'
            }
          ]
        }
      ]
    }
  }
  dependsOn: [backendAcrPull]
}

output backendAppName string = backendApp.name
output frontendAppName string = frontendApp.name
output migrationJobName string = migrationJob.name
output caeId string = cae.id
output caeName string = cae.name
output backendFqdn string = backendApp.properties.configuration.ingress.fqdn
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn
output backendIdentityPrincipalId string = backendIdentity.properties.principalId
output frontendIdentityPrincipalId string = frontendIdentity.properties.principalId
output backendIdentityClientId string = backendIdentity.properties.clientId
