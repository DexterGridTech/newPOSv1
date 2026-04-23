import type {ErrorDefinition} from './error'
import type {ParameterDefinition} from './parameter'

export interface AppModuleDependency {
    moduleName: string
    optional?: boolean
}

export interface AppModuleCommandDescriptor {
    name: string
    visibility?: 'public' | 'internal'
}

export interface AppModuleActorDescriptor {
    name: string
}

export interface AppModuleMiddlewareDescriptor {
    name: string
    priority?: number
}

export interface AppModuleSliceDescriptor {
    name: string
    persistIntent?: 'never' | 'owner-only'
}

export interface AppModule {
    moduleName: string
    packageVersion: string
    protocolVersion?: string
    dependencies?: readonly AppModuleDependency[]
    errorDefinitions?: readonly ErrorDefinition[]
    parameterDefinitions?: readonly ParameterDefinition<any>[]
    commands?: readonly AppModuleCommandDescriptor[]
    actors?: readonly AppModuleActorDescriptor[]
    middlewares?: readonly AppModuleMiddlewareDescriptor[]
    slices?: readonly AppModuleSliceDescriptor[]
}
