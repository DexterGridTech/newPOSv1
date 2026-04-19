import {createDualTopologyHostV3Server} from '../../../../0-mock-server/dual-topology-host-v3/src'

const main = async () => {
    const server = createDualTopologyHostV3Server({
        config: {
            port: 0,
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
