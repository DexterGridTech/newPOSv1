import {moduleName} from '../moduleName'

export const dualTopologyHostV3ServerParameters = {
    defaultPort: {
        key: `${moduleName}.server.default-port`,
        name: 'Dual topology host V3 default port',
        defaultValue: 8888,
    },
    defaultBasePath: {
        key: `${moduleName}.server.default-base-path`,
        name: 'Dual topology host V3 default base path',
        defaultValue: '/mockMasterServer',
    },
} as const
