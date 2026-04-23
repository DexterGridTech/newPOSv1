export type AssemblyTopologyRole = 'master' | 'slave'

export interface AssemblyTopologyLaunchOptions {
    role?: AssemblyTopologyRole
    localNodeId?: string
    masterNodeId?: string
    masterDeviceId?: string
    wsUrl?: string
    httpBaseUrl?: string
}
