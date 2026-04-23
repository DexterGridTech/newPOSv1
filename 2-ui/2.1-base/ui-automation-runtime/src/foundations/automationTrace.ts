export interface AutomationTraceEntry {
    readonly step: string
    readonly status: 'ok' | 'failed'
    readonly input?: unknown
    readonly output?: unknown
    readonly error?: string
    readonly createdAt: number
}

export interface AutomationTrace {
    record(entry: Omit<AutomationTraceEntry, 'createdAt'>): void
    getLastTrace(): AutomationTraceEntry | undefined
    getTraceHistory(limit?: number): readonly AutomationTraceEntry[]
    clear(): void
}

export const createAutomationTrace = (maxEntries = 50): AutomationTrace => {
    const history: AutomationTraceEntry[] = []

    return {
        record(entry) {
            history.push({
                ...entry,
                createdAt: Date.now(),
            })
            while (history.length > maxEntries) {
                history.shift()
            }
        },
        getLastTrace() {
            return history.at(-1)
        },
        getTraceHistory(limit = maxEntries) {
            return history.slice(Math.max(0, history.length - limit))
        },
        clear() {
            history.length = 0
        },
    }
}
