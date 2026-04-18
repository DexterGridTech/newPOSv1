export interface AutomationMessageTransport {
    send(message: string): void
    close(): void
}

export interface WebSocketAutomationHost {
    attach(transport: AutomationMessageTransport): () => void
    broadcast(message: string): void
}

export const createWebSocketAutomationHost = (): WebSocketAutomationHost => {
    const transports = new Set<AutomationMessageTransport>()
    return {
        attach(transport) {
            transports.add(transport)
            return () => {
                transports.delete(transport)
            }
        },
        broadcast(message) {
            for (const transport of transports) {
                transport.send(message)
            }
        },
    }
}
