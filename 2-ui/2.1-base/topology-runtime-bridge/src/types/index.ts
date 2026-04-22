export interface TopologyPowerDisplaySwitchAlertCopy {
    primaryTitle: string
    secondaryTitle: string
    message: string
    confirmText: string
    cancelText: string
    autoConfirmAfterMs?: number
}

export interface CreateTopologyRuntimeBridgeModuleInput {
    powerDisplaySwitchAlert?: TopologyPowerDisplaySwitchAlertCopy
}
