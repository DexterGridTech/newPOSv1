import {describe, expect, it} from 'vitest'
import {createLoggerPort, createPlatformPorts} from '@next/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createTransportRuntimeModule,
    resolveTransportServers,
    selectTransportAvailableServerSpaces,
    selectTransportSelectedServerSpace,
    selectTransportServerSpaceState,
    transportRuntimeCommandDefinitions,
    type TransportServerConfig,
} from '../../src'

const testServerConfig: TransportServerConfig = {
    selectedSpace: 'dev',
    spaces: [
        {
            name: 'dev',
            servers: [
                {
                    serverName: 'mock-terminal-platform',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://dev-primary.local'},
                    ],
                },
            ],
        },
        {
            name: 'prod',
            servers: [
                {
                    serverName: 'mock-terminal-platform',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://prod-primary.local'},
                    ],
                },
            ],
        },
    ],
}

const createMemoryStorage = () => {
    const saved = new Map<string, string>()
    return {
        saved,
        storage: {
            async getItem(key: string) {
                return saved.get(key) ?? null
            },
            async setItem(key: string, value: string) {
                saved.set(key, value)
            },
            async removeItem(key: string) {
                saved.delete(key)
            },
            async multiGet(keys: readonly string[]) {
                return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => saved.delete(key))
            },
            async getAllKeys() {
                return [...saved.keys()]
            },
        },
    }
}

const createRuntime = (
    stateStorage = createMemoryStorage(),
    localNodeId = 'transport-server-space-runtime',
) => createKernelRuntimeV2({
    localNodeId: localNodeId as any,
    platformPorts: createPlatformPorts({
        environmentMode: 'DEV',
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write: () => {},
            scope: {
                moduleName: 'kernel.base.transport-runtime.test',
                layer: 'kernel',
            },
        }),
        stateStorage: stateStorage.storage,
    }),
    modules: [
        createTransportRuntimeModule({serverConfig: testServerConfig}),
    ],
})

describe('transport-runtime server space', () => {
    it('initializes selected and available server spaces from config', async () => {
        const runtime = createRuntime()

        await runtime.start()

        expect(selectTransportServerSpaceState(runtime.getState())).toEqual({
            selectedSpace: 'dev',
            availableSpaces: ['dev', 'prod'],
        })
        expect(selectTransportSelectedServerSpace(runtime.getState())).toBe('dev')
        expect(selectTransportAvailableServerSpaces(runtime.getState())).toEqual(['dev', 'prod'])
    })

    it('switches selected server space through a public command and persists it', async () => {
        const stateStorage = createMemoryStorage()
        const runtime = createRuntime(stateStorage)

        await runtime.start()
        const result = await runtime.dispatchCommand(createCommand(
            transportRuntimeCommandDefinitions.setSelectedServerSpace,
            {selectedSpace: 'prod'},
        ))
        await runtime.flushPersistence()

        expect(result.status).toBe('COMPLETED')
        expect(selectTransportSelectedServerSpace(runtime.getState())).toBe('prod')
        expect(resolveTransportServers(testServerConfig, {
            selectedSpace: selectTransportSelectedServerSpace(runtime.getState()),
        })[0]?.addresses[0]?.baseUrl).toBe('http://prod-primary.local')

        const restartedRuntime = createRuntime(stateStorage)
        await restartedRuntime.start()

        expect(selectTransportSelectedServerSpace(restartedRuntime.getState())).toBe('prod')
    })

    it('rejects unknown server spaces through the public command', async () => {
        const runtime = createRuntime()

        await runtime.start()
        const result = await runtime.dispatchCommand(createCommand(
            transportRuntimeCommandDefinitions.setSelectedServerSpace,
            {selectedSpace: 'missing'},
        ))

        expect(result.status).toBe('FAILED')
        expect(selectTransportSelectedServerSpace(runtime.getState())).toBe('dev')
    })

    it('applies base URL overrides without mutating config server definitions', () => {
        const servers = resolveTransportServers(testServerConfig, {
            selectedSpace: 'dev',
            baseUrlOverrides: {
                'mock-terminal-platform': 'http://127.0.0.1:5810',
            },
        })

        expect(servers[0]?.addresses).toEqual([
            {addressName: 'primary', baseUrl: 'http://127.0.0.1:5810'},
        ])
        expect(testServerConfig.spaces[0]?.servers[0]?.addresses[0]?.baseUrl)
            .toBe('http://dev-primary.local')
    })
})
