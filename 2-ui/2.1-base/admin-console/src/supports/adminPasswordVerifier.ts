import type {AdminPasswordVerifier} from '../types'

const formatHour = (date: Date): string => {
    const year = `${date.getFullYear()}`
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    const hour = `${date.getHours()}`.padStart(2, '0')
    return `${year}${month}${day}${hour}`
}

const deriveNumericTail = (seed: string): string => {
    let hash = 0
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 131 + seed.charCodeAt(index)) >>> 0
    }
    const numeric = `${hash}${seed.length * 97}`
    return numeric.slice(-6).padStart(6, '0')
}

export const createAdminPasswordVerifier = (input: {
    deviceIdProvider: () => Promise<string> | string
    nowProvider?: () => Date
}): AdminPasswordVerifier => {
    const nowProvider = input.nowProvider ?? (() => new Date())

    const deriveFor = (date: Date, deviceId: string): string =>
        deriveNumericTail(`${deviceId}${formatHour(date)}`)

    return {
        deriveFor(date: Date) {
            const deviceId = input.deviceIdProvider()
            if (typeof deviceId !== 'string') {
                throw new Error('[ui-base-admin-console] deriveFor requires a synchronous deviceIdProvider')
            }
            return deriveFor(date, deviceId)
        },
        verify(password: string): boolean {
            const deviceId = input.deviceIdProvider()
            if (typeof deviceId !== 'string') {
                throw new Error('[ui-base-admin-console] verify requires a synchronous deviceIdProvider')
            }
            const now = nowProvider()

            return [-1, 0, 1].some(offset => {
                const candidate = new Date(now)
                candidate.setHours(candidate.getHours() + offset)
                return deriveFor(candidate, deviceId) === password
            })
        },
    }
}
