import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import {moduleName} from '../moduleName'

export const tcpControlErrorDefinitions = {
    activationCodeInvalid: {
        key: 'kernel.base.tcp-control-runtime.activation_code_invalid',
        name: 'TCP Activation Code Invalid',
        defaultTemplate: 'Terminal activation code is invalid',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    activationFailed: {
        key: 'kernel.base.tcp-control-runtime.activation_failed',
        name: 'TCP Activation Failed',
        defaultTemplate: 'Terminal activation failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    credentialMissing: {
        key: 'kernel.base.tcp-control-runtime.credential_missing',
        name: 'TCP Credential Missing',
        defaultTemplate: 'Terminal credential is missing',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    credentialExpired: {
        key: 'kernel.base.tcp-control-runtime.credential_expired',
        name: 'TCP Credential Expired',
        defaultTemplate: 'Terminal access credential has expired',
        category: 'AUTHORIZATION',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    refreshFailed: {
        key: 'kernel.base.tcp-control-runtime.refresh_failed',
        name: 'TCP Refresh Failed',
        defaultTemplate: 'Terminal credential refresh failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
        moduleName,
    } satisfies ErrorDefinition,
    taskResultReportFailed: {
        key: 'kernel.base.tcp-control-runtime.task_result_report_failed',
        name: 'TCP Task Result Report Failed',
        defaultTemplate: 'Terminal task result report failed: ${error}',
        category: 'NETWORK',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
    bootstrapHydrationFailed: {
        key: 'kernel.base.tcp-control-runtime.bootstrap_hydration_failed',
        name: 'TCP Bootstrap Hydration Failed',
        defaultTemplate: 'Terminal control bootstrap failed: ${error}',
        category: 'SYSTEM',
        severity: 'MEDIUM',
        moduleName,
    } satisfies ErrorDefinition,
} as const

export const tcpControlErrorDefinitionList: readonly ErrorDefinition[] = Object.values(
    tcpControlErrorDefinitions,
)
