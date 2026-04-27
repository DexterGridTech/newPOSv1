import {packageVersion} from './generated/packageVersion'
import {createDualTopologyHostV3Server} from './runtime/createDualTopologyHostV3Server'

export {moduleName} from './moduleName'
export {packageVersion}
export {createDualTopologyHostV3} from './runtime/createDualTopologyHostV3'
export {createDualTopologyHostV3Server} from './runtime/createDualTopologyHostV3Server'
export * from './supports'
export type * from './types/hostShell'
export type * from './types/server'

const readNumberEnv = (key: string): number | undefined => {
    const rawValue = process.env[key]
    if (!rawValue) {
        return undefined
    }
    const parsed = Number(rawValue)
    return Number.isFinite(parsed) ? parsed : undefined
}

const isCliEntry = (): boolean => {
    const entry = process.argv[1]
    if (!entry) {
        return false
    }
    return import.meta.url === new URL(entry, 'file:').href
}

const startCli = async () => {
    const port = readNumberEnv('DUAL_TOPOLOGY_HOST_V3_PORT')
    const server = createDualTopologyHostV3Server({
        config: {
            ...(port == null ? {} : {port}),
            ...(process.env.DUAL_TOPOLOGY_HOST_V3_BASE_PATH
                ? {basePath: process.env.DUAL_TOPOLOGY_HOST_V3_BASE_PATH}
                : {}),
        },
    })
    await server.start()
    const addressInfo = server.getAddressInfo()
    console.log(JSON.stringify({
        service: 'dual-topology-host-v3',
        status: 'RUNNING',
        ...addressInfo,
    }))

    const close = async (signal: NodeJS.Signals) => {
        await server.close()
        console.log(JSON.stringify({
            service: 'dual-topology-host-v3',
            status: 'CLOSED',
            signal,
        }))
        process.exit(0)
    }
    process.once('SIGINT', () => void close('SIGINT'))
    process.once('SIGTERM', () => void close('SIGTERM'))
}

if (isCliEntry()) {
    startCli().catch(error => {
        console.error(error)
        process.exit(1)
    })
}
