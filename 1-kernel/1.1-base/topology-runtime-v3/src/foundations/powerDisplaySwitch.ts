export const TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID =
    'kernel.base.topology-runtime-v3.power-display-switch-confirm'

export const resolvePowerDisplaySwitchTarget = (input: {
    context?: {
        standalone?: boolean
        instanceMode?: string
        displayMode?: string
    } | null
    powerConnected: boolean
}): 'PRIMARY' | 'SECONDARY' | null => {
    const {context, powerConnected} = input
    if (context?.standalone !== true || context.instanceMode !== 'SLAVE') {
        return null
    }
    if (powerConnected && context.displayMode === 'PRIMARY') {
        return 'SECONDARY'
    }
    if (!powerConnected && context.displayMode === 'SECONDARY') {
        return 'PRIMARY'
    }
    return null
}
