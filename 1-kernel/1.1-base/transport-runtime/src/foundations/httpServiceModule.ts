export interface HttpServiceModuleDefinition<TServices> {
    readonly moduleName: string
    readonly services: TServices
}

export const defineHttpServiceModule = <TServices>(
    moduleName: string,
    services: TServices,
): HttpServiceModuleDefinition<TServices> => {
    return {
        moduleName,
        services,
    }
}
