import type {
    TopologyV3ActivationStatus,
    TopologyV3ContextState,
    TopologyV3EligibilityReasonCode,
    TopologyV3EligibilityResult,
} from '../types'

type MinimalTopologyContext = Pick<
    TopologyV3ContextState,
    'displayIndex' | 'displayCount' | 'instanceMode' | 'displayMode' | 'standalone'
>

const createEligibility = (
    allowed: boolean,
    reasonCode: TopologyV3EligibilityReasonCode,
): TopologyV3EligibilityResult => ({
    allowed,
    reasonCode,
})

export const isTopologyV3ManagedSecondary = (
    context: MinimalTopologyContext,
): boolean => context.displayCount > 1 && context.displayIndex > 0

export const isTopologyV3StandaloneSlave = (
    context: MinimalTopologyContext,
): boolean => context.displayIndex === 0 && context.instanceMode === 'SLAVE'

export const getTopologyV3TcpActivationEligibility = (input: {
    context: MinimalTopologyContext
    activationStatus?: TopologyV3ActivationStatus
}): TopologyV3EligibilityResult => {
    if (isTopologyV3ManagedSecondary(input.context)) {
        return createEligibility(false, 'managed-secondary')
    }
    if (input.context.instanceMode === 'SLAVE') {
        return createEligibility(false, 'slave-instance')
    }
    if (input.activationStatus === 'ACTIVATED') {
        return createEligibility(false, 'already-activated')
    }
    return createEligibility(true, 'master-unactivated')
}

export const getTopologyV3SwitchToSlaveEligibility = (input: {
    context: MinimalTopologyContext
    activationStatus?: TopologyV3ActivationStatus
}): TopologyV3EligibilityResult => {
    if (isTopologyV3ManagedSecondary(input.context)) {
        return createEligibility(false, 'managed-secondary')
    }
    if (input.activationStatus === 'ACTIVATED') {
        return createEligibility(false, 'activated-master-cannot-switch-to-slave')
    }
    return createEligibility(true, 'master-unactivated')
}

export const getTopologyV3EnableSlaveEligibility = (input: {
    context: MinimalTopologyContext
}): TopologyV3EligibilityResult => {
    if (isTopologyV3ManagedSecondary(input.context)) {
        return createEligibility(false, 'managed-secondary')
    }
    if (
        input.context.instanceMode !== 'MASTER'
        || input.context.displayIndex !== 0
    ) {
        if (input.context.instanceMode === 'SLAVE') {
            return createEligibility(false, 'slave-instance')
        }
        return createEligibility(false, 'master-primary-enable-slave')
    }
    return createEligibility(true, 'master-primary-enable-slave')
}

export const getTopologyV3DisplayModeEligibility = (input: {
    context: MinimalTopologyContext
}): TopologyV3EligibilityResult => {
    if (isTopologyV3ManagedSecondary(input.context)) {
        return createEligibility(false, 'managed-secondary')
    }
    if (!isTopologyV3StandaloneSlave(input.context)) {
        return createEligibility(false, 'standalone-slave-only-display-mode')
    }
    return createEligibility(true, 'standalone-slave-only-display-mode')
}
