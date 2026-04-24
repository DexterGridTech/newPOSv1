import {
    resolveTopologyV3SocketServerFromUrls,
    type TopologyV3SocketServerDefinition,
} from '@next/kernel-base-topology-runtime-v3'

export interface AssemblyTopologyBindingState {
    role: 'master' | 'slave'
    localNodeId: string
    masterNodeId?: string
    masterDeviceId?: string
    wsUrl?: string
    httpBaseUrl?: string
}

export type AssemblyTopologyResolvedServer = TopologyV3SocketServerDefinition

export interface AssemblyTopologyBindingSource {
    get(): AssemblyTopologyBindingState
    set(next: Partial<AssemblyTopologyBindingState>): void
    clear(): void
    resolveServer(): AssemblyTopologyResolvedServer | undefined
}

export const createAssemblyTopologyBindingSource = (
    initial: AssemblyTopologyBindingState,
): AssemblyTopologyBindingSource => {
    let current = {...initial}

    return {
        get() {
            return {...current}
        },
        set(next) {
            current = {
                ...current,
                ...next,
            }
        },
        clear() {
            current = {
                role: current.role,
                localNodeId: current.localNodeId,
            }
        },
        resolveServer() {
            return resolveTopologyV3SocketServerFromUrls({
                wsUrl: current.wsUrl,
                httpBaseUrl: current.httpBaseUrl,
            })
        },
    }
}
