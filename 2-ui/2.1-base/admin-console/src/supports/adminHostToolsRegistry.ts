import type {AdminHostTools, AdminHostToolsResolver} from '../types'

const createEmptyAdminHostTools = (): AdminHostTools => ({})

type AdminHostToolsScopeKey = Parameters<AdminHostToolsResolver['get']>[0]

const scopedHostTools = new Map<AdminHostToolsScopeKey, AdminHostTools>()

const getScopedHostTools = (localNodeId: AdminHostToolsScopeKey): AdminHostTools => {
    const existing = scopedHostTools.get(localNodeId)
    if (existing) {
        return existing
    }
    const created = createEmptyAdminHostTools()
    scopedHostTools.set(localNodeId, created)
    return created
}

export const adminHostToolsResolver: AdminHostToolsResolver = {
    get(localNodeId) {
        return getScopedHostTools(localNodeId)
    },
    install(localNodeId, hostTools) {
        scopedHostTools.set(localNodeId, {
            ...getScopedHostTools(localNodeId),
            ...hostTools,
        })
    },
    reset(localNodeId) {
        if (localNodeId == null) {
            scopedHostTools.clear()
            return
        }
        scopedHostTools.delete(localNodeId)
    },
}

export const getAdminHostTools = (localNodeId: AdminHostToolsScopeKey): Readonly<AdminHostTools> =>
    adminHostToolsResolver.get(localNodeId)

export const installAdminHostTools = (
    localNodeId: AdminHostToolsScopeKey,
    hostTools: Partial<AdminHostTools>,
) => {
    adminHostToolsResolver.install(localNodeId, hostTools)
}

export const resetAdminHostTools = (localNodeId?: AdminHostToolsScopeKey) => {
    adminHostToolsResolver.reset(localNodeId)
}
