import type {TransportServerConfig} from '@next/kernel-base-contracts'
import {
    SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from './serverName'

export const SERVER_CONFIG_SPACE_KERNEL_BASE_DEV = 'kernel-base-dev'

export const kernelBaseDevServerConfig: TransportServerConfig = {
    selectedSpace: SERVER_CONFIG_SPACE_KERNEL_BASE_DEV,
    spaces: [
        {
            name: SERVER_CONFIG_SPACE_KERNEL_BASE_DEV,
            servers: [
                {
                    serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
                    addresses: [
                        {
                            addressName: 'lan',
                            baseUrl: 'http://192.168.0.172:5810',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'local',
                            baseUrl: 'http://127.0.0.1:5810',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'localhost',
                            baseUrl: 'http://localhost:5810',
                            timeoutMs: 3_000,
                        },
                    ],
                },
                {
                    serverName: SERVER_NAME_DUAL_TOPOLOGY_HOST_V3,
                    addresses: [
                        {
                            addressName: 'local',
                            baseUrl: 'http://127.0.0.1:8888/mockMasterServer',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'localhost',
                            baseUrl: 'http://localhost:8888/mockMasterServer',
                            timeoutMs: 3_000,
                        },
                    ],
                },
            ],
        },
    ],
}
