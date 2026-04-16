import type {AdminHostTools} from '../types'

const createEmptyAdminHostTools = (): AdminHostTools => ({})

let sharedAdminHostTools: AdminHostTools = createEmptyAdminHostTools()

export const getAdminHostTools = (): Readonly<AdminHostTools> => sharedAdminHostTools

export const installAdminHostTools = (
    hostTools: Partial<AdminHostTools>,
) => {
    sharedAdminHostTools = {
        ...sharedAdminHostTools,
        ...hostTools,
    }
}

export const resetAdminHostTools = () => {
    sharedAdminHostTools = createEmptyAdminHostTools()
}
