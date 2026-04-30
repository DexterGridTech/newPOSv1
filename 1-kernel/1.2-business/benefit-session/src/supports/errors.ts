import {createModuleErrorFactory, listDefinitions} from '@next/kernel-base-contracts'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

export const benefitSessionErrorDefinitions = {
    benefitCenterRequestFailed: defineError('benefit_center_request_failed', {
        name: 'Benefit Center Request Failed',
        defaultTemplate: 'Benefit center request failed: ${error}',
        category: 'NETWORK',
        severity: 'HIGH',
    }),
} as const

export const benefitSessionErrorDefinitionList = listDefinitions(benefitSessionErrorDefinitions)
