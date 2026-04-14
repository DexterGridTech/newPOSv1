import type {KernelRuntimeModuleV2, RegisteredActorHandler} from '../types'

export const createRuntimeActorRegistry = (modules: readonly KernelRuntimeModuleV2[]) => {
    const handlersByCommand = new Map<string, RegisteredActorHandler[]>()
    let actorOrder = 0

    modules.forEach(module => {
        ;(module.actorDefinitions ?? []).forEach(actorDefinition => {
            const actorKey = actorDefinition.actorKey ?? `${actorDefinition.moduleName}.${actorDefinition.actorName}`
            actorDefinition.handlers.forEach(handler => {
                const next = handlersByCommand.get(handler.commandName) ?? []
                next.push({
                    actor: {
                        actorKey,
                        moduleName: actorDefinition.moduleName,
                        actorName: actorDefinition.actorName,
                    },
                    commandName: handler.commandName,
                    handle: handler.handle,
                    order: actorOrder++,
                })
                handlersByCommand.set(handler.commandName, next)
            })
        })
    })

    return {
        handlersByCommand,
        getActorCount() {
            return [...handlersByCommand.values()].reduce((count, value) => count + value.length, 0)
        },
    }
}
