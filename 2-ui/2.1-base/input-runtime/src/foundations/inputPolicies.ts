import type {
    InputPersistencePolicy,
    ManagedInputMode,
} from '../types'

export const usesVirtualKeyboard = (
    mode: ManagedInputMode,
): boolean => mode.startsWith('virtual-')

export const canPersistInputValue = (
    persistence: InputPersistencePolicy,
): boolean => persistence === 'recoverable'
