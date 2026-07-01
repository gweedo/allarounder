// Consumption budget + email alerts, scoped to the resource group this module
// is deployed into (no filter needed — RG-scoped budgets track only that RG's cost).

@description('Environment name (staging or production), used in the budget name')
param env string

@description('Monthly budget amount in the subscription currency')
param amount int

@description('Email addresses notified when a threshold is crossed')
param contactEmails array

@description('Budget start date, first of a month, YYYY-MM-DD. Defaults to the first of the current month at deploy time — Azure rejects a start date outside the current billing period on creation.')
param startDate string = utcNow('yyyy-MM-01')

@description('Budget end date, YYYY-MM-DD (Consumption budgets require an explicit end date; defaults to 10 years out)')
param endDate string = '2036-12-31'

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'allarounder-${env}-monthly-budget'
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
      endDate: endDate
    }
    notifications: {
      Actual50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      Actual80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      Actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      Forecasted100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
      }
    }
  }
}

output budgetId string = budget.id
