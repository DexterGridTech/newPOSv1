import type {ManagedInputMode} from '../types'

export const inputModes = {
    systemText: 'system-text',
    systemPassword: 'system-password',
    systemNumber: 'system-number',
    virtualNumber: 'virtual-number',
    virtualPin: 'virtual-pin',
    virtualAmount: 'virtual-amount',
    virtualActivationCode: 'virtual-activation-code',
    virtualIdentifier: 'virtual-identifier',
    virtualJson: 'virtual-json',
} as const satisfies Record<string, ManagedInputMode>
