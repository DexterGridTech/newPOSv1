export const now = () => Date.now()

export const createId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`

export const normalizeId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const serializeJson = (value: unknown) => JSON.stringify(value ?? {})

export const cloneJson = <T>(value: T): T => parseJson<T>(serializeJson(value), value)

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback

export const asOptionalString = (value: unknown) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized ? normalized : undefined
}

export const asNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export const asBoolean = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback
