import type {ManagedInputMode, VirtualKeyboardKey} from '../types'

export interface VirtualKeyboardLayout {
    title: string
    rows: readonly (readonly VirtualKeyboardKey[])[]
    enterLabel?: string
    maxWidth: number
}

const numberRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'backspace'],
] as const satisfies readonly (readonly VirtualKeyboardKey[])[]

const amountRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0', '.', 'backspace'],
] as const satisfies readonly (readonly VirtualKeyboardKey[])[]

const activationRows = [
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'backspace'],
] as const satisfies readonly (readonly VirtualKeyboardKey[])[]

export const getVirtualKeyboardLayout = (
    mode: ManagedInputMode,
): VirtualKeyboardLayout => {
    switch (mode) {
        case 'virtual-amount':
            return {
                title: '金额键盘',
                rows: amountRows,
                enterLabel: '完成',
                maxWidth: 420,
            }
        case 'virtual-activation-code':
            return {
                title: '激活码键盘',
                rows: activationRows,
                enterLabel: '完成',
                maxWidth: 520,
            }
        case 'virtual-pin':
            return {
                title: 'PIN 键盘',
                rows: numberRows,
                enterLabel: '完成',
                maxWidth: 360,
            }
        case 'virtual-number':
        default:
            return {
                title: '数字键盘',
                rows: numberRows,
                enterLabel: '完成',
                maxWidth: 360,
            }
    }
}
