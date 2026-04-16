export type AssemblyTopologyRole = 'master' | 'slave'

export interface AssemblyTopologyLaunchOptions {
    role?: AssemblyTopologyRole
    localNodeId?: string
    masterNodeId?: string
    ticketToken?: string
    wsUrl?: string
    httpBaseUrl?: string
}
