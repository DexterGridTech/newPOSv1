import type {HttpRuntime} from '../types/http'
import type {ServerCatalog, TransportServerAddress} from '../types/transport'

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const ensureLeadingSlash = (value: string): string =>
    value.startsWith('/') ? value : `/${value}`

const joinBaseUrlAndPath = (
    baseUrl: string,
    pathOrUrl: string,
): string => `${trimTrailingSlash(baseUrl)}${ensureLeadingSlash(pathOrUrl)}`

const unique = (values: readonly string[]): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const value of values) {
        if (seen.has(value)) {
            continue
        }
        seen.add(value)
        result.push(value)
    }
    return result
}

export interface ResolveHttpUrlCandidatesInput {
    readonly runtime?: Pick<HttpRuntime, 'getServerCatalog'>
    readonly catalog?: Pick<ServerCatalog, 'resolveAddresses'>
    readonly serverName: string
    readonly pathOrUrl: string
}

export const resolveHttpUrlCandidates = (
    input: ResolveHttpUrlCandidatesInput,
): string[] => {
    if (ABSOLUTE_HTTP_URL_PATTERN.test(input.pathOrUrl)) {
        return [input.pathOrUrl]
    }

    const catalog = input.catalog ?? input.runtime?.getServerCatalog()
    if (!catalog) {
        throw new Error('HTTP url candidate resolver requires a runtime or catalog')
    }

    const addresses: readonly TransportServerAddress[] = catalog.resolveAddresses(input.serverName)
    return unique(addresses.map(address => joinBaseUrlAndPath(address.baseUrl, input.pathOrUrl)))
}
