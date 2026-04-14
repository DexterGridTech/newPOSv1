export const fetchJson = async <TValue>(input: string | URL, init?: RequestInit): Promise<TValue> => {
    const response = await fetch(input, init)
    const payload = await response.json() as TValue
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`)
    }
    return payload
}
