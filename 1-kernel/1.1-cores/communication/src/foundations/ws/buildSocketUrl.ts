import {compilePath} from '../shared/PathTemplate'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function trimLeadingSlash(value: string): string {
  return value.startsWith('/') ? value.slice(1) : value
}

function normalizeBase(baseURL: string): string {
  const httpNormalized = baseURL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  return httpNormalized.endsWith('/') ? httpNormalized : `${httpNormalized}/`
}

export function buildSocketUrl(
  baseURL: string,
  pathTemplate: string,
  query?: Record<string, unknown>,
  path?: Record<string, unknown>,
): string {
  const compiledPath = compilePath(pathTemplate, path)
  const joinedUrl = `${trimTrailingSlash(normalizeBase(baseURL))}/${trimLeadingSlash(compiledPath)}`
  const url = new URL(joinedUrl)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return
      }
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}
