import type {
    HttpSuccessResponse,
    HttpTransport,
    HttpTransportRequest,
} from '../types/http'

export interface FetchHttpTransportInput {
    fetchImpl?: typeof fetch
    defaultHeaders?: Record<string, string>
}

const readHeaders = (headers: Headers): Record<string, string> => {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
        result[key] = value
    })
    return result
}

const readResponseData = async <TResponse>(
    response: Response,
): Promise<TResponse> => {
    const text = await response.text()
    if (!text) {
        return undefined as TResponse
    }

    return JSON.parse(text) as TResponse
}

export const createFetchHttpTransport = (
    input: FetchHttpTransportInput = {},
): HttpTransport => {
    const executeFetch = input.fetchImpl ?? fetch

    return {
        async execute<TPath, TQuery, TBody, TResponse>(
            request: HttpTransportRequest<TPath, TQuery, TBody>,
        ): Promise<HttpSuccessResponse<TResponse>> {
            const response = await executeFetch(request.url, {
                method: request.endpoint.method,
                headers: {
                    'content-type': 'application/json',
                    ...(input.defaultHeaders ?? {}),
                    ...(request.input.headers ?? {}),
                },
                body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
            })

            return {
                data: await readResponseData<TResponse>(response),
                status: response.status,
                statusText: response.statusText,
                headers: readHeaders(response.headers),
            }
        },
    }
}
