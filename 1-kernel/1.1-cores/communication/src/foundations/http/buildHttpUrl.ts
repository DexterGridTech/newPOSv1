import {compilePath} from '../shared/PathTemplate'

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function trimLeadingSlash(value: string): string {
  return value.startsWith('/') ? value.slice(1) : value
}

function appendQuery(url: URL, query?: Record<string, unknown>): URL {
  if (!query) {
    return url
  }
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, String(item)))
      return
    }
    url.searchParams.set(key, String(value))
  })
  return url
}

export function buildHttpUrl(
  baseURL: string,
  pathTemplate: string,
  path?: Record<string, unknown>,
  query?: Record<string, unknown>,
): string {
  const compiledPath = compilePath(pathTemplate, path)
  const joinedUrl = `${trimTrailingSlash(baseURL)}/${trimLeadingSlash(compiledPath)}`
  const url = new URL(joinedUrl)
  return appendQuery(url, query).toString()
}
