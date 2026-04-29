import type {AutomationTarget} from '../types/protocol'
import type {AutomationNodeQuery, AutomationNodeSnapshot} from '../types/selectors'

type SemanticTarget = Exclude<AutomationTarget, 'all' | 'host'>

export interface SemanticRegistry {
    registerNode(node: AutomationNodeSnapshot): () => void
    updateNode(target: SemanticTarget, nodeId: string, patch: Partial<AutomationNodeSnapshot>): void
    queryNodes(query: AutomationNodeQuery): readonly AutomationNodeSnapshot[]
    getNode(target: SemanticTarget, nodeId: string): AutomationNodeSnapshot | undefined
    clearScreenContext(target: SemanticTarget, visibleContextKeys: readonly string[]): void
    clearTarget(target: SemanticTarget): void
}

export const createSemanticRegistry = (): SemanticRegistry => {
    const liveNodes = new Map<string, AutomationNodeSnapshot>()
    const staleNodes = new Map<string, AutomationNodeSnapshot>()

    const keyOf = (target: SemanticTarget, nodeId: string) => `${target}:${nodeId}`

    const markStale = (key: string) => {
        const node = liveNodes.get(key)
        if (!node) {
            return
        }
        liveNodes.delete(key)
        staleNodes.set(key, {...node, stale: true})
    }

    return {
        registerNode(node) {
            const key = keyOf(node.target, node.nodeId)
            liveNodes.set(key, {...node, stale: false})
            staleNodes.delete(key)
            return () => markStale(key)
        },
        updateNode(target, nodeId, patch) {
            const key = keyOf(target, nodeId)
            const node = liveNodes.get(key)
            if (node) {
                liveNodes.set(key, {...node, ...patch, target, nodeId})
            }
        },
        queryNodes(query) {
            return [...liveNodes.values()].filter(node => {
                if (node.target !== query.target) return false
                if (query.nodeId && node.nodeId !== query.nodeId) return false
                if (!node.visible) return false
                if (query.testID && node.testID !== query.testID) return false
                if (query.semanticId && node.semanticId !== query.semanticId) return false
                if (query.text && node.text !== query.text) return false
                if (query.role && node.role !== query.role) return false
                if (query.screen && node.screenKey !== query.screen) return false
                return true
            })
        },
        getNode(target, nodeId) {
            const key = keyOf(target, nodeId)
            return liveNodes.get(key) ?? staleNodes.get(key)
        },
        clearScreenContext(target, visibleContextKeys) {
            for (const [key, node] of liveNodes.entries()) {
                if (
                    node.target === target
                    && !node.persistent
                    && !visibleContextKeys.includes(node.screenKey)
                ) {
                    markStale(key)
                }
            }
        },
        clearTarget(target) {
            for (const [key, node] of liveNodes.entries()) {
                if (node.target === target) {
                    markStale(key)
                }
            }
        },
    }
}
