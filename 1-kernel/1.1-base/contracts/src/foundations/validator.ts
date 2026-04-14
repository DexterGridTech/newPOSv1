export const nonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0
}

export const finiteNumberAtLeast = (minimum: number) => {
    return (value: unknown): value is number => {
        return typeof value === 'number' && Number.isFinite(value) && value >= minimum
    }
}

export const positiveFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export const nonNegativeFiniteNumber = finiteNumberAtLeast(0)

export const integerAtLeast = (minimum: number) => {
    return (value: unknown): value is number => {
        return typeof value === 'number' && Number.isInteger(value) && value >= minimum
    }
}
