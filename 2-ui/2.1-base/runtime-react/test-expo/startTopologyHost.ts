import {createDualTopologyHostServer} from '../../../../0-mock-server/dual-topology-host/src'

const main = async () => {
    const server = createDualTopologyHostServer({
        config: {
            port: 0,
            heartbeatIntervalMs: 50,
            heartbeatTimeoutMs: 5000,
        },
    })
    await server.start()
    const addressInfo = server.getAddressInfo()

    process.stdout.write(`${JSON.stringify({
        addressInfo,
    })}\n`)

    const shutdown = async () => {
        await server.close()
        process.exit(0)
    }

    process.on('SIGINT', () => {
        void shutdown()
    })
    process.on('SIGTERM', () => {
        void shutdown()
    })
}

void main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exit(1)
})
