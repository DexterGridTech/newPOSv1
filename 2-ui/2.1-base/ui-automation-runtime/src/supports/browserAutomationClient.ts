import {
    AUTOMATION_HOST_GLOBAL_KEY,
    type BrowserAutomationGlobal,
} from './browserAutomationHost'
import {createAutomationJsonRpcClient} from './jsonRpcAutomationClient'

type BrowserGlobalScope = typeof globalThis & {
    [AUTOMATION_HOST_GLOBAL_KEY]?: BrowserAutomationGlobal
}

export const resolveBrowserAutomationHost = (): BrowserAutomationGlobal => {
    const host = (globalThis as BrowserGlobalScope)[AUTOMATION_HOST_GLOBAL_KEY]
    if (!host?.started) {
        throw new Error('Browser automation host is not started')
    }
    return host
}

export const createBrowserAutomationClient = () =>
    createAutomationJsonRpcClient({
        async dispatchMessage(messageJson: string) {
            return await resolveBrowserAutomationHost().dispatchMessage(messageJson)
        },
    })
