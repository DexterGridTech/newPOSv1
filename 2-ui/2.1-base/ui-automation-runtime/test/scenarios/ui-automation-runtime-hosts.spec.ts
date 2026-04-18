import {afterEach, describe, expect, it, vi} from 'vitest'
import {createAutomationJsonRpcClient} from '../../src/supports/jsonRpcAutomationClient'
import {createBrowserScriptExecutorAdapter} from '../../src/supports/scriptExecutorAdapter'
import {
    AUTOMATION_HOST_GLOBAL_KEY,
    createBrowserAutomationHost,
} from '../../src/supports/browserAutomationHost'
import {createBrowserAutomationClient} from '../../src/supports/browserAutomationClient'

const html = String.raw
const hasDocument = typeof document !== 'undefined'

afterEach(() => {
    if (hasDocument) {
        document.body.innerHTML = ''
    }
    delete (globalThis as Record<string, unknown>)[AUTOMATION_HOST_GLOBAL_KEY]
    vi.restoreAllMocks()
})

describe('automation host adapters', () => {
    it('executes scripts through an injected host executor', async () => {
        const adapter = createBrowserScriptExecutorAdapter({
            execute(source, params): unknown {
                return {source, params}
            },
        })

        await expect(adapter.execute({
            source: 'return params.value',
            params: {value: 42},
        })).resolves.toEqual({
            source: 'return params.value',
            params: {value: 42},
        })
    })

    it('does not start browser host until explicitly started', () => {
        const host = createBrowserAutomationHost({autoStart: false})
        expect(host.started).toBe(false)
        host.start()
        expect(host.started).toBe(true)
        host.stop()
        expect(host.started).toBe(false)
    })

    it('handles JSON-RPC requests without a DOM when only runtime methods are used', async () => {
        const host = createBrowserAutomationHost({
            autoStart: true,
            runtimeId: 'browser-test',
            getRuntimeState: () => ({
                demo: {
                    value: 42,
                },
            }),
        })
        const client = createBrowserAutomationClient()

        await expect(client.call('session.hello')).resolves.toMatchObject({
            protocolVersion: 1,
            availableTargets: ['host', 'primary'],
        })
        await expect(client.call('runtime.selectState', {
            target: 'primary',
            path: ['demo', 'value'],
        })).resolves.toBe(42)
        await expect(client.call('scripts.execute', {
            source: 'return params.value + 1',
            params: {value: 41},
        })).resolves.toBe(42)

        host.stop()
    })

    const browserIt = hasDocument ? it : it.skip

    browserIt('exposes a JSON-RPC browser automation host on the global object', async () => {
        document.body.innerHTML = html`
            <button data-testid="browser.button">Click me</button>
            <input data-testid="browser.input" value="old" />
        `
        const input = document.querySelector('[data-testid="browser.input"]') as HTMLInputElement
        const button = document.querySelector('[data-testid="browser.button"]') as HTMLButtonElement
        const clickListener = vi.fn()
        button.addEventListener('click', clickListener)
        const host = createBrowserAutomationHost({
            autoStart: true,
            runtimeId: 'browser-test',
        })
        const client = createBrowserAutomationClient()

        await expect(client.call('session.hello')).resolves.toMatchObject({
            protocolVersion: 1,
            availableTargets: ['host', 'primary'],
        })
        await expect(client.call('ui.getNode', {
            target: 'primary',
            nodeId: 'browser.button',
        })).resolves.toMatchObject({
            testID: 'browser.button',
            text: 'Click me',
        })

        await client.call('ui.setValue', {
            target: 'primary',
            nodeId: 'browser.input',
            value: 'new',
        })
        expect(input.value).toBe('new')

        await client.call('ui.performAction', {
            target: 'primary',
            nodeId: 'browser.button',
            action: 'press',
        })
        expect(clickListener).toHaveBeenCalledTimes(1)

        await expect(client.call('scripts.execute', {
            source: 'return params.value + 1',
            params: {value: 41},
        })).resolves.toBe(42)

        host.stop()
    })

    browserIt('can be called through a JSON-RPC client dispatcher', async () => {
        document.body.innerHTML = '<div data-testid="browser.ready">ready</div>'
        const host = createBrowserAutomationHost({autoStart: true})
        const client = createAutomationJsonRpcClient({
            dispatchMessage: host.dispatchMessage,
        })

        await expect(client.call('wait.forNode', {
            target: 'primary',
            testID: 'browser.ready',
            timeoutMs: 100,
        })).resolves.toMatchObject({
            text: 'ready',
        })

        host.stop()
    })
})
