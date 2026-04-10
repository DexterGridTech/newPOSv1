import * as contractsModule from '@impos2/kernel-base-contracts'
import * as hostRuntimeModule from '@impos2/kernel-base-host-runtime'
import * as platformPortsModule from '@impos2/kernel-base-platform-ports'

const unwrapRuntimeModule = <TModule extends Record<string, unknown>>(moduleValue: TModule): TModule => {
    const nestedDefault = (moduleValue as {default?: TModule}).default
    if (nestedDefault && typeof nestedDefault === 'object' && Object.keys(nestedDefault).length > 0) {
        return nestedDefault
    }
    return moduleValue
}

export const runtimeContracts = unwrapRuntimeModule(contractsModule) as typeof import('@impos2/kernel-base-contracts')
export const runtimeHostRuntime = unwrapRuntimeModule(hostRuntimeModule) as typeof import('@impos2/kernel-base-host-runtime')
export const runtimePlatformPorts = unwrapRuntimeModule(platformPortsModule) as typeof import('@impos2/kernel-base-platform-ports')
