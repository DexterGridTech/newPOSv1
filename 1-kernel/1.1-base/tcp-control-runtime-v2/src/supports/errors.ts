import {createModuleErrorFactory, listDefinitions} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const tcpControlV2ErrorDefinitions = {
    activationCodeInvalid: defineError('activation_code_invalid', {
        name: 'TCP Activation Code Invalid',
        defaultTemplate: 'Terminal activation code is invalid',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
    }),
    activationFailed: defineError('activation_failed', {
        name: 'TCP Activation Failed',
        defaultTemplate: 'Terminal activation failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
    credentialMissing: defineError('credential_missing', {
        name: 'TCP Credential Missing',
        defaultTemplate: 'Terminal credential is missing',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
    }),
    credentialExpired: defineError('credential_expired', {
        name: 'TCP Credential Expired',
        defaultTemplate: 'Terminal access credential has expired',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
    }),
    refreshFailed: defineError('refresh_failed', {
        name: 'TCP Refresh Failed',
        defaultTemplate: 'Terminal credential refresh failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
    taskResultReportFailed: defineError('task_result_report_failed', {
        name: 'TCP Task Result Report Failed',
        defaultTemplate: 'Terminal task result report failed: ${error}',
        category: 'NETWORK',
        severity: 'MEDIUM',
    }),
    bootstrapHydrationFailed: defineError('bootstrap_hydration_failed', {
        name: 'TCP Bootstrap Hydration Failed',
        defaultTemplate: 'Terminal control bootstrap failed: ${error}',
        category: 'SYSTEM',
        severity: 'MEDIUM',
    }),
} as const

export const tcpControlV2ErrorDefinitionList = listDefinitions(tcpControlV2ErrorDefinitions)
