export interface PaginationQuery {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export const parsePagination = (input: { page?: unknown; pageSize?: unknown }): PaginationQuery => {
  const page = Math.max(1, Number(input.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize ?? 20)))
  return { page, pageSize }
}

export const paginateItems = <T>(items: T[], query: PaginationQuery): PaginatedResult<T> => {
  const start = (query.page - 1) * query.pageSize
  const sliced = items.slice(start, start + query.pageSize)
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  return {
    items: sliced,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
  }
}
