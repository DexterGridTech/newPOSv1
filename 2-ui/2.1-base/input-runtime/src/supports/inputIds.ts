let nextInputSequence = 0

export const createInputRuntimeId = (prefix = 'input'): string => {
    nextInputSequence += 1
    return `ui-base-input-runtime:${prefix}:${nextInputSequence}`
}
