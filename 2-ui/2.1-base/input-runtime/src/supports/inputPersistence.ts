import type {
    InputControllerState,
    InputPersistencePolicy,
} from '../types'
import {canPersistInputValue} from '../foundations/inputPolicies'

export const toPersistedInputValue = (
    state: InputControllerState,
): string | null => canPersistInputValue(state.persistence) ? state.value : null

export const shouldRestoreInputValue = (
    persistence: InputPersistencePolicy,
): boolean => canPersistInputValue(persistence)
