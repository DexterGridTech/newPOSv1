export interface AssemblyTopologyHostLifecycleContext {
    displayCount?: number
    displayIndex?: number
    instanceMode?: string
    enableSlave?: boolean
}

export interface AssemblyTopologyHostLifecycleDecision {
    shouldRun: boolean
    reason: 'master-primary-enable-slave' | 'not-master-or-single-primary-host'
}

export const decideAssemblyTopologyHostLifecycle = (
    input: AssemblyTopologyHostLifecycleContext | undefined,
): AssemblyTopologyHostLifecycleDecision => {
    if (
        input?.displayCount === 1
        && input.displayIndex === 0
        && input.instanceMode === 'MASTER'
        && input.enableSlave === true
    ) {
        return {
            shouldRun: true,
            reason: 'master-primary-enable-slave',
        }
    }

    return {
        shouldRun: false,
        reason: 'not-master-or-single-primary-host',
    }
}
