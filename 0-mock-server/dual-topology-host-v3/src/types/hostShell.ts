export interface DualTopologyHostV3Snapshot {
    state: 'idle' | 'running' | 'closed'
    sessionCount: number
}

export interface DualTopologyHostV3 {
    getSnapshot(): DualTopologyHostV3Snapshot
    markRunning(): void
    markClosed(): void
}
