import type {TransportServerConfig} from '@next/kernel-base-contracts'

export const SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST = 'kernel-base-http-failover-test'
export const SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST = 'demo'

export const SERVER_CONFIG_SPACE_KERNEL_BASE_TEST = 'kernel-base-test'
export const SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_RETRY_TEST = 'kernel-base-http-retry-test'
export const SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_REPLACEMENT_TEST = 'kernel-base-http-replacement-test'

export const kernelBaseTestServerConfig: TransportServerConfig = {
    selectedSpace: SERVER_CONFIG_SPACE_KERNEL_BASE_TEST,
    spaces: [
        {
            name: SERVER_CONFIG_SPACE_KERNEL_BASE_TEST,
            servers: [
                {
                    serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
                    addresses: [
                        {
                            addressName: 'primary',
                            baseUrl: 'http://primary.local',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'secondary',
                            baseUrl: 'http://secondary.local',
                            timeoutMs: 3_000,
                        },
                    ],
                },
                {
                    serverName: SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST,
                    addresses: [
                        {
                            addressName: 'primary',
                            baseUrl: 'http://primary.local',
                            timeoutMs: 3_000,
                        },
                    ],
                },
            ],
        },
        {
            name: SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_RETRY_TEST,
            servers: [
                {
                    serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
                    addresses: [
                        {
                            addressName: 'primary',
                            baseUrl: 'http://primary.local',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'secondary',
                            baseUrl: 'http://secondary.local',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'tertiary',
                            baseUrl: 'http://tertiary.local',
                            timeoutMs: 3_000,
                        },
                    ],
                },
            ],
        },
        {
            name: SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_REPLACEMENT_TEST,
            servers: [
                {
                    serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
                    addresses: [
                        {
                            addressName: 'new-primary',
                            baseUrl: 'http://new-primary.local',
                            timeoutMs: 3_000,
                        },
                        {
                            addressName: 'new-secondary',
                            baseUrl: 'http://new-secondary.local',
                            timeoutMs: 3_000,
                        },
                    ],
                },
            ],
        },
    ],
}
