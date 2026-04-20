import packageJson from '../../../package.json'

export type AssemblyAutomationBuildProfile = 'debug' | 'internal' | 'product'

export type AssemblyAdbSocketDebugPackageConfig = {
    assembly?: {
        adbSocketDebug?: {
            enabled?: boolean
        }
    }
}

export type ResolveAssemblyAdbSocketDebugConfigInput = {
    enabled: boolean
    environmentMode: 'DEV' | 'PROD'
}

export type AssemblyAdbSocketDebugConfig = {
    enabled: boolean
    buildProfile: AssemblyAutomationBuildProfile
    scriptExecutionAvailable: boolean
}

const packageConfig = packageJson as AssemblyAdbSocketDebugPackageConfig

export const isAssemblyAdbSocketDebugEnabled = (): boolean =>
    packageConfig.assembly?.adbSocketDebug?.enabled === true

export const resolveAssemblyAdbSocketDebugConfig = (
    input: ResolveAssemblyAdbSocketDebugConfigInput,
): AssemblyAdbSocketDebugConfig => {
    if (!input.enabled) {
        return {
            enabled: false,
            buildProfile: 'product',
            scriptExecutionAvailable: false,
        }
    }

    return {
        enabled: true,
        buildProfile: input.environmentMode === 'DEV' ? 'debug' : 'internal',
        scriptExecutionAvailable: true,
    }
}

export const getAssemblyAdbSocketDebugConfig = (
    environmentMode: ResolveAssemblyAdbSocketDebugConfigInput['environmentMode'],
): AssemblyAdbSocketDebugConfig =>
    resolveAssemblyAdbSocketDebugConfig({
        enabled: isAssemblyAdbSocketDebugEnabled(),
        environmentMode,
    })
