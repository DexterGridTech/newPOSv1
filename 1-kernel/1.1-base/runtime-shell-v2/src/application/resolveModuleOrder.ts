import type {KernelRuntimeModuleV2} from '../types'

const visitStatePending = 1
const visitStateVisited = 2

export const resolveKernelRuntimeModuleOrderV2 = (
    modules: readonly KernelRuntimeModuleV2[],
): KernelRuntimeModuleV2[] => {
    const modulesByName = new Map<string, KernelRuntimeModuleV2>()
    const visitState = new Map<string, number>()
    const ordered: KernelRuntimeModuleV2[] = []

    modules.forEach(module => {
        if (modulesByName.has(module.moduleName)) {
            throw new Error(`Duplicate kernel runtime module detected: ${module.moduleName}`)
        }
        modulesByName.set(module.moduleName, module)
    })

    const visit = (module: KernelRuntimeModuleV2) => {
        const currentState = visitState.get(module.moduleName)
        if (currentState === visitStateVisited) {
            return
        }
        if (currentState === visitStatePending) {
            throw new Error(`Circular kernel runtime module dependency detected: ${module.moduleName}`)
        }

        visitState.set(module.moduleName, visitStatePending)
        for (const dependency of module.dependencies ?? []) {
            const dependencyModule = modulesByName.get(dependency.moduleName)
            if (!dependencyModule) {
                if (dependency.optional) {
                    continue
                }
                throw new Error(
                    `Missing required kernel runtime module dependency: ${module.moduleName} -> ${dependency.moduleName}`,
                )
            }
            visit(dependencyModule)
        }
        visitState.set(module.moduleName, visitStateVisited)
        ordered.push(module)
    }

    modules.forEach(visit)
    return ordered
}

