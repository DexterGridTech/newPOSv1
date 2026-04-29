export const TDP_EXPIRES_AT_LOCAL_DROP_GRACE_MS = 5 * 60 * 1000

export const toTdpProjectionExpiresAtMs = (expiresAt: string | null | undefined) => {
    if (!expiresAt) {
        return undefined
    }
    const parsed = Date.parse(expiresAt)
    return Number.isFinite(parsed) ? parsed : undefined
}

export const isTdpProjectionExpiredForLocalDefense = (
    expiresAt: string | null | undefined,
    estimatedServerNow: number,
) => {
    const expiresAtMs = toTdpProjectionExpiresAtMs(expiresAt)
    if (expiresAtMs == null) {
        return false
    }
    return expiresAtMs + TDP_EXPIRES_AT_LOCAL_DROP_GRACE_MS <= estimatedServerNow
}

export const estimateTdpServerNow = (
    localNow: number,
    serverClockOffsetMs?: number,
) => localNow + (serverClockOffsetMs ?? 0)

export const computeTdpServerClockOffsetMs = (
    serverTimestamp: number | string | null | undefined,
    localNow: number,
) => {
    const timestamp = typeof serverTimestamp === 'number'
        ? serverTimestamp
        : typeof serverTimestamp === 'string'
            ? Date.parse(serverTimestamp)
            : NaN
    return Number.isFinite(timestamp) ? timestamp - localNow : undefined
}
