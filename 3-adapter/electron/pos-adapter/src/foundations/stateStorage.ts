export const stateStorageAdapter = {
    getItem: async (key: string): Promise<any> => {
        const val = localStorage.getItem(key)
        if (val === null) return null
        try { return JSON.parse(val) } catch { return val }
    },
    setItem: async (key: string, value: any): Promise<void> => {
        localStorage.setItem(key, JSON.stringify(value))
    },
    removeItem: async (key: string): Promise<void> => {
        localStorage.removeItem(key)
    },
}
