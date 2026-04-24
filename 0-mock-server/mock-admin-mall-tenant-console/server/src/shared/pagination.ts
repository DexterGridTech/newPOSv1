export interface PaginationQuery {
  page: number
  size: number
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  size: number
  total: number
  totalPages: number
}

export const parsePagination = (input: {page?: unknown; size?: unknown; pageSize?: unknown}): PaginationQuery => {
  const page = Math.max(1, Number(input.page ?? 1))
  const size = Math.min(100, Math.max(1, Number(input.size ?? input.pageSize ?? 20)))
  return {page, size}
}

export const paginateItems = <T>(items: T[], query: PaginationQuery): PaginatedResult<T> => {
  const start = (query.page - 1) * query.size
  const sliced = items.slice(start, start + query.size)
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / query.size))
  return {
    items: sliced,
    page: query.page,
    size: query.size,
    total,
    totalPages,
  }
}
