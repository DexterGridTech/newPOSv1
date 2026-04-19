export type ManagedInputMode =
    | 'system-text'
    | 'system-password'
    | 'system-number'
    | 'virtual-number'
    | 'virtual-pin'
    | 'virtual-amount'
    | 'virtual-activation-code'
    | 'virtual-identifier'
    | 'virtual-json'

export type InputPersistencePolicy =
    | 'transient'
    | 'recoverable'
    | 'secure-never-persist'

export type VirtualKeyboardKey =
    | '0'
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '.'
    | ':'
    | ','
    | '"'
    | '{'
    | '}'
    | '['
    | ']'
    | '/'
    | '-'
    | '_'
    | 'A'
    | 'B'
    | 'C'
    | 'D'
    | 'E'
    | 'F'
    | 'G'
    | 'H'
    | 'I'
    | 'J'
    | 'K'
    | 'L'
    | 'M'
    | 'S'
    | 'N'
    | 'O'
    | 'P'
    | 'Q'
    | 'R'
    | 'T'
    | 'U'
    | 'V'
    | 'W'
    | 'X'
    | 'Y'
    | 'Z'
    | 'backspace'
    | 'clear'
    | 'enter'
    | 'close'

export interface InputControllerState {
    value: string
    mode: ManagedInputMode
    persistence: InputPersistencePolicy
    maxLength?: number
}

export interface InputController {
    getState(): InputControllerState
    setValue(value: string): void
    applyVirtualKey(key: VirtualKeyboardKey): void
    clear(): void
}
