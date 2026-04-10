import type {KernelRuntimeModule} from '../types/module'

export const resolveRuntimeModules = (
    modules: readonly KernelRuntimeModule[],
): readonly KernelRuntimeModule[] => {
    const resolved: KernelRuntimeModule[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const byName = new Map<string, KernelRuntimeModule>()

    modules.forEach(module => {
        byName.set(module.moduleName, module)
    })

    const visit = (module: KernelRuntimeModule) => {
        if (visited.has(module.moduleName)) {
            return
        }

        if (visiting.has(module.moduleName)) {
            throw new Error(`Circular module dependency detected: ${module.moduleName}`)
        }

        visiting.add(module.moduleName)

        ;(module.dependencies ?? []).forEach(dependency => {
            const dependencyModule = byName.get(dependency.moduleName)

            if (!dependencyModule) {
                if (dependency.optional) {
                    return
                }
                throw new Error(
                    `Module dependency not found: ${module.moduleName} -> ${dependency.moduleName}`,
                )
            }

            visit(dependencyModule)
        })

        visiting.delete(module.moduleName)
        visited.add(module.moduleName)
        resolved.push(module)
    }

    modules.forEach(visit)
    return resolved
}
