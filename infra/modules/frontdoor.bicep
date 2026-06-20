param env string
param frontendFqdn string
param storageAccountName string
param storageContainerName string
param canonicalDomain string = 'allarounder.it'
param redirectDomain string = 'allarounder.eu'

// Front Door Premium is required for managed rules with per-ruleSet action override
resource frontDoorProfile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: 'allarounder-${env}-afd'
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
}

// WAF policy: managed rules in Detection (ruleSetAction: Log), custom rate-limit in Prevention (action: Block)
resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2024-02-01' = {
  name: 'allarounder${env}waf'
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
    }
    customRules: {
      rules: [
        {
          name: 'RateLimitPerIp'
          enabledState: 'Enabled'
          priority: 1
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 1000
          matchConditions: [
            {
              matchVariable: 'SocketAddr'
              operator: 'IPMatch'
              negateCondition: false
              matchValue: ['0.0.0.0/0', '::/0']
            }
          ]
          action: 'Block'
        }
      ]
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Log'
        }
      ]
    }
  }
}

// Origin group for the frontend Container App
resource frontendOriginGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: 'frontend-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
  }
}

resource frontendOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: frontendOriginGroup
  name: 'frontend'
  properties: {
    hostName: frontendFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: frontendFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

resource cdnOriginGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: frontDoorProfile
  name: 'cdn-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/${storageContainerName}/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 60
    }
  }
}

resource cdnOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: cdnOriginGroup
  name: 'blob-storage'
  properties: {
    hostName: '${storageAccountName}.blob.${environment().suffixes.storage}'
    httpPort: 80
    httpsPort: 443
    originHostHeader: '${storageAccountName}.blob.${environment().suffixes.storage}'
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

// Rule set for security headers (HSTS + redirect .eu → .it)
resource securityHeadersRuleSet 'Microsoft.Cdn/profiles/ruleSets@2024-02-01' = {
  parent: frontDoorProfile
  name: 'SecurityHeaders'
}

resource hstsRule 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: securityHeadersRuleSet
  name: 'AddHsts'
  properties: {
    order: 1
    conditions: []
    actions: [
      {
        name: 'ModifyResponseHeader'
        parameters: {
          typeName: 'DeliveryRuleHeaderActionParameters'
          headerAction: 'Overwrite'
          headerName: 'Strict-Transport-Security'
          value: 'max-age=31536000; includeSubDomains'
        }
      }
    ]
    matchProcessingBehavior: 'Continue'
  }
}

// Rule set for the .eu → .it 301 redirect
resource redirectRuleSet 'Microsoft.Cdn/profiles/ruleSets@2024-02-01' = {
  parent: frontDoorProfile
  name: 'EuRedirect'
}

resource redirectEuToItRule 'Microsoft.Cdn/profiles/ruleSets/rules@2024-02-01' = {
  parent: redirectRuleSet
  name: 'RedirectEuToIt'
  properties: {
    order: 1
    conditions: [
      {
        name: 'RequestHeader'
        parameters: {
          typeName: 'DeliveryRuleRequestHeaderConditionParameters'
          selector: 'Host'
          operator: 'Contains'
          negateCondition: false
          matchValues: [redirectDomain]
          transforms: ['Lowercase']
        }
      }
    ]
    actions: [
      {
        name: 'UrlRedirect'
        parameters: {
          typeName: 'DeliveryRuleUrlRedirectActionParameters'
          redirectType: 'PermanentRedirect'
          destinationProtocol: 'Https'
          customHostname: canonicalDomain
        }
      }
    ]
    matchProcessingBehavior: 'Stop'
  }
}

// Default endpoint (maps to canonical domain)
resource afdEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoorProfile
  name: 'allarounder-${env}'
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

// Main site route (all traffic → frontend)
resource mainRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: afdEndpoint
  name: 'main-route'
  properties: {
    enabledState: 'Enabled'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    patternsToMatch: ['/*']
    supportedProtocols: ['Http', 'Https']
    originGroup: {
      id: frontendOriginGroup.id
    }
    forwardingProtocol: 'HttpsOnly'
    cacheConfiguration: null
    ruleSets: [
      { id: securityHeadersRuleSet.id }
      { id: redirectRuleSet.id }
    ]
  }
  dependsOn: [frontendOrigin, hstsRule, redirectEuToItRule]
}

// CDN route (images served from Blob Storage)
resource cdnRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: afdEndpoint
  name: 'cdn-route'
  properties: {
    enabledState: 'Enabled'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    patternsToMatch: ['/images/*']
    supportedProtocols: ['Http', 'Https']
    originGroup: {
      id: cdnOriginGroup.id
    }
    forwardingProtocol: 'HttpsOnly'
    cacheConfiguration: {
      queryStringCachingBehavior: 'IgnoreQueryString'
      compressionSettings: {
        isCompressionEnabled: true
        contentTypesToCompress: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      }
    }
  }
  dependsOn: [cdnOrigin]
}

// WAF security policy associated with the endpoint
resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: frontDoorProfile
  name: 'waf-policy'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            { id: afdEndpoint.id }
          ]
          patternsToMatch: ['/*']
        }
      ]
    }
  }
}

// Custom domains (DNS must be verified separately)
resource canonicalCustomDomain 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = {
  parent: frontDoorProfile
  name: replace(canonicalDomain, '.', '-')
  properties: {
    hostName: canonicalDomain
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

resource redirectCustomDomain 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = {
  parent: frontDoorProfile
  name: replace(redirectDomain, '.', '-')
  properties: {
    hostName: redirectDomain
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

output frontDoorId string = frontDoorProfile.id
output frontDoorEndpointHostname string = afdEndpoint.properties.hostName
output wafPolicyId string = wafPolicy.id
