import {moduleName} from '../moduleName'

export const dualTopologyHostServerParameters = {
    defaultPort: {
        key: `${moduleName}.server.default-port`,
        name: 'Dual topology host default port',
        defaultValue: 8888,
    },
    defaultBasePath: {
        key: `${moduleName}.server.default-base-path`,
        name: 'Dual topology host default base path',
        defaultValue: '/mockMasterServer',
    },
    heartbeatIntervalMs: {
        key: `${moduleName}.server.heartbeat-interval-ms`,
        name: 'Dual topology host heartbeat interval in milliseconds',
        defaultValue: 30_000,
    },
    heartbeatTimeoutMs: {
        key: `${moduleName}.server.heartbeat-timeout-ms`,
        name: 'Dual topology host heartbeat timeout in milliseconds',
        defaultValue: 60_000,
    },
    defaultTicketExpiresInMs: {
        key: `${moduleName}.server.default-ticket-expires-in-ms`,
        name: 'Dual topology host default ticket expiry in milliseconds',
        defaultValue: 5 * 60 * 1000,
    },
} as const
