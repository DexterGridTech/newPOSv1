import {describe, expect, it} from 'vitest'
// @ts-ignore
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createHttpRuntime,
    defineHttpEndpoint,
    typed,
    type HttpTransport,
} from '../../src'

describe('transport-runtime http', () => {
    it('fails over to the second address when the first address fails', async () => {
        const calls: string[] = []

        const transport: HttpTransport = {
            // @ts-ignore
            async execute(request) {
                calls.push(request.selectedAddress.addressName)
                if (request.selectedAddress.addressName === 'primary') {
                    throw new Error('primary failed')
                }

                return {
                    data: {ok: true},
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                }
            },
        }

        const runtime = createHttpRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport,
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                        {addressName: 'secondary', baseUrl: 'http://secondary.local'},
                    ],
                },
            ],
            executionPolicy: {
                retryRounds: 0,
                failoverStrategy: 'ordered',
            },
        })

        const endpoint = defineHttpEndpoint<void, {q: string}, void, {ok: boolean}>({
            name: 'demo.http.echo',
            serverName: 'demo',
            method: 'GET',
            pathTemplate: '/echo',
            request: {
                query: typed<{q: string}>('demo.http.echo.query'),
            },
            response: typed<{ok: boolean}>('demo.http.echo.response'),
        })

        const response = await runtime.call(endpoint, {
            query: {q: '1'},
        })

        expect(response.data.ok).toBe(true)
        expect(calls).toEqual(['primary', 'secondary'])
    })
})
