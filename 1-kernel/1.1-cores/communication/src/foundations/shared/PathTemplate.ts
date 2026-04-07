import {CommunicationError} from '../../types'

const PATH_PARAM_PATTERN = /\{([a-zA-Z0-9_]+)\}/g

export interface PathMatchResult<TPath extends Record<string, string> = Record<string, string>> {
  matched: boolean
  params?: TPath
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`
  }
  return path
}

export function extractPathParamNames(pathTemplate: string): string[] {
  const matches = pathTemplate.matchAll(PATH_PARAM_PATTERN)
  return Array.from(matches, match => match[1])
}

export function compilePath<TPath extends Record<string, unknown>>(
  pathTemplate: string,
  pathParams?: TPath,
): string {
  const normalizedTemplate = normalizePath(pathTemplate)
  const names = extractPathParamNames(normalizedTemplate)

  if (names.length === 0) {
    return normalizedTemplate
  }

  return names.reduce((currentPath, name) => {
    const rawValue = pathParams?.[name]
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      throw new CommunicationError(
        'MISSING_PATH_PARAM',
        `缺少路径参数: ${name}`,
        {pathTemplate: normalizedTemplate, pathParams},
      )
    }
    return currentPath.replace(`{${name}}`, encodeURIComponent(String(rawValue)))
  }, normalizedTemplate)
}

export function matchPath<TPath extends Record<string, string> = Record<string, string>>(
  pathTemplate: string,
  actualPath: string,
): PathMatchResult<TPath> {
  const normalizedTemplate = normalizePath(pathTemplate)
  const normalizedActualPath = normalizePath(actualPath)
  const names = extractPathParamNames(normalizedTemplate)

  if (names.length === 0) {
    return {matched: normalizedTemplate === normalizedActualPath}
  }

  const regexPattern = normalizedTemplate.replace(PATH_PARAM_PATTERN, '([^/]+)')
  const regex = new RegExp(`^${regexPattern}$`)
  const matched = normalizedActualPath.match(regex)
  if (!matched) {
    return {matched: false}
  }

  const params = names.reduce<Record<string, string>>((result, name, index) => {
    result[name] = decodeURIComponent(matched[index + 1])
    return result
  }, {})

  return {
    matched: true,
    params: params as TPath,
  }
}
