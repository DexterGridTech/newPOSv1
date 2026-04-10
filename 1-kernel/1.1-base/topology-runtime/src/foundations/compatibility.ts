import type {CompatibilityDecision} from '@impos2/kernel-base-contracts'
import type {CompatibilityEvaluationInput} from '../types/runtime'

export const evaluateCompatibility = (
    input: CompatibilityEvaluationInput,
): CompatibilityDecision => {
    const localCapabilities = input.localCapabilities ?? []

    if (input.localProtocolVersion !== input.peerProtocolVersion) {
        return {
            level: 'rejected',
            reasons: ['protocolVersion mismatch'],
            enabledCapabilities: [],
            disabledCapabilities: [...input.peerCapabilities],
        }
    }

    const missingRequiredCapabilities = (input.requiredCapabilities ?? []).filter(capability => {
        return !input.peerCapabilities.includes(capability)
    })

    if (missingRequiredCapabilities.length > 0) {
        return {
            level: 'rejected',
            reasons: missingRequiredCapabilities.map(capability => `missing capability: ${capability}`),
            enabledCapabilities: [],
            disabledCapabilities: [...input.peerCapabilities],
        }
    }

    const enabledCapabilities = input.peerCapabilities.filter(capability => {
        return localCapabilities.includes(capability)
    })

    const disabledCapabilities = input.peerCapabilities.filter(capability => {
        return !enabledCapabilities.includes(capability)
    })

    const runtimeMismatch =
        input.localRuntimeVersion &&
        input.peerRuntimeVersion &&
        input.localRuntimeVersion !== input.peerRuntimeVersion

    if (runtimeMismatch) {
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
