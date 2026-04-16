import type {
    InputPersistencePolicy,
    ManagedInputMode,
} from '../types'

export interface InputFieldDefinition {
    key: string
    mode: ManagedInputMode
    persistence?: InputPersistencePolicy
    promptText?: string
    secureTextEntry?: boolean
    maxLength?: number
}

export const defineInputField = (
    input: InputFieldDefinition,
): InputFieldDefinition => ({
    ...input,
    persistence: input.persistence ?? 'transient',
})
