import type {CompatibilityDecision, NodeRuntimeInfo} from '@next/kernel-base-contracts'

export interface EvaluateHostCompatibilityInput {
    hostRuntime: NodeRuntimeInfo
    peerRuntime: NodeRuntimeInfo
    requiredCapabilities?: readonly string[]
}

export const evaluateHostCompatibility = (
    input: EvaluateHostCompatibilityInput,
): CompatibilityDecision => {
    if (input.hostRuntime.protocolVersion !== input.peerRuntime.protocolVersion) {
        return {
            level: 'rejected',
            reasons: ['protocolVersion mismatch'],
            enabledCapabilities: [],
            disabledCapabilities: [...input.peerRuntime.capabilities],
        }
    }

    const missingRequiredCapabilities = (input.requiredCapabilities ?? []).filter(capability => {
        return !input.peerRuntime.capabilities.includes(capability)
    })

    if (missingRequiredCapabilities.length > 0) {
        return {
            level: 'rejected',
            reasons: missingRequiredCapabilities.map(capability => `missing capability: ${capability}`),
            enabledCapabilities: [],
            disabledCapabilities: [...input.peerRuntime.capabilities],
        }
    }

    const enabledCapabilities = input.peerRuntime.capabilities.filter(capability => {
        return input.hostRuntime.capabilities.includes(capability)
    })
    const disabledCapabilities = input.peerRuntime.capabilities.filter(capability => {
        return !enabledCapabilities.includes(capability)
    })

    if (input.hostRuntime.runtimeVersion !== input.peerRuntime.runtimeVersion) {
        return {
            level: 'degraded',
            reasons: ['runtimeVersion mismatch'],
            enabledCapabilities,
            disabledCapabilities,
        }
    }

    return {
        level: 'full',
        reasons: [],
        enabledCapabilities,
        disabledCapabilities,
    }
}
