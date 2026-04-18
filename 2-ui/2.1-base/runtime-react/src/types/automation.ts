export interface RuntimeReactAutomationNodeRegistration {
    readonly target: 'primary' | 'secondary'
    readonly runtimeId: string
    readonly screenKey: string
    readonly mountId: string
    readonly nodeId: string
    readonly testID?: string
    readonly semanticId?: string
    readonly role?: string
    readonly text?: string
    readonly value?: unknown
    readonly visible: boolean
    readonly enabled: boolean
    readonly focused?: boolean
    readonly bounds?: {
        readonly x: number
        readonly y: number
        readonly width: number
        readonly height: number
    }
    readonly availableActions: readonly string[]
    readonly persistent?: boolean
    readonly onAutomationAction?: (input: RuntimeReactAutomationActionInput) => Promise<unknown> | unknown
}

export interface RuntimeReactAutomationActionInput {
    readonly target: 'primary' | 'secondary'
    readonly nodeId: string
    readonly action: string
    readonly value?: unknown
}

export interface RuntimeReactAutomationBridge {
    registerNode(node: RuntimeReactAutomationNodeRegistration): () => void
    updateNode(
        target: 'primary' | 'secondary',
        nodeId: string,
        patch: Partial<RuntimeReactAutomationNodeRegistration>,
    ): void
    clearVisibleContexts(
        target: 'primary' | 'secondary',
        visibleContextKeys: readonly string[],
    ): void
    clearTarget(target: 'primary' | 'secondary'): void
}
