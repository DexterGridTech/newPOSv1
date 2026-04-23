export interface AssemblyTopologyStorageGateSnapshot {
    displayMode?: string
    standalone?: boolean
}

export const shouldDisableAssemblyStatePersistence = (
    snapshot: AssemblyTopologyStorageGateSnapshot | undefined,
): boolean => snapshot?.displayMode === 'SECONDARY' && snapshot.standalone === false
