import {getHostBridge} from '../foundations/hostBridge';

type AxiosMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

type AxiosHeaders = Record<string, string>;

type AxiosRequestConfig = {
  url?: string;
  baseURL?: string;
  method?: string;
  headers?: Record<string, unknown>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
  cancelToken?: {
    throwIfRequested?: () => void;
    promise?: Promise<{message?: string}>;
    reason?: {message?: string};
  };
  [key: string]: unknown;
};

type AxiosResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: AxiosHeaders;
  config: AxiosRequestConfig;
  request: {url: string; method: string};
};

type AxiosError<T = unknown> = Error & {
  config?: AxiosRequestConfig;
  code?: string;
  response?: AxiosResponse<T>;
  isAxiosError: true;
};

type FulfilledHandler<T> = (value: T) => T | Promise<T>;
type RejectedHandler<T> = (error: unknown) => T | Promise<T>;

type InterceptorManager<T> = {
  use(onFulfilled?: FulfilledHandler<T>, onRejected?: RejectedHandler<T>): number;
};

type CancelSource = {
  token: CancelToken;
  cancel(message?: string): void;
};

type AxiosLike = {
  defaults: AxiosRequestConfig;
  interceptors: {
    request: InterceptorManager<AxiosRequestConfig>;
    response: InterceptorManager<AxiosResponse>;
  };
  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  head<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  options<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
};

class CancelToken {
  promise: Promise<{message?: string}>;
  reason?: {message?: string; __CANCEL__: true};

  private resolvePromise!: (reason: {message?: string; __CANCEL__: true}) => void;

  constructor(executor: (cancel: (message?: string) => void) => void) {
    this.promise = new Promise(resolve => {
      this.resolvePromise = resolve;
    });

    executor((message?: string) => {
      if (this.reason) {
        return;
      }
      this.reason = {message, __CANCEL__: true};
      this.resolvePromise(this.reason);
    });
  }

  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }

  static source(): CancelSource {
    let cancel!: (message?: string) => void;
    const token = new CancelToken(c => {
      cancel = c;
    });
    return {token, cancel};
  }
}

function createInterceptorManager<T>() {
  const handlers: Array<{
    onFulfilled?: FulfilledHandler<T>;
    onRejected?: RejectedHandler<T>;
  }> = [];

  return {
    handlers,
    use(onFulfilled?: FulfilledHandler<T>, onRejected?: RejectedHandler<T>) {
      handlers.push({onFulfilled, onRejected});
      return handlers.length - 1;
    },
  };
}

function normalizeHeaders(headers?: Record<string, unknown>): AxiosHeaders {
  const normalized: AxiosHeaders = {};
  Object.entries(headers ?? {}).forEach(([key, value]) => {
    if (value == null) {
      return;
    }
    normalized[key] = String(value);
  });
  return normalized;
}

function isAbsoluteUrl(url: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url);
}

function combineUrls(baseURL?: string, url?: string) {
  if (!url) {
    return baseURL ?? '';
  }
  if (!baseURL || isAbsoluteUrl(url)) {
    return url;
  }
  return new URL(url, baseURL).toString();
}

function isElectronLocalWebServerRegister(url: string, method: string) {
  try {
    const parsed = new URL(url);
    return method === 'POST'
      && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
      && parsed.pathname === '/localServer/register';
  } catch {
    return false;
  }
}

function createAxiosError<T = unknown>(
  message: string,
  config: AxiosRequestConfig,
  response?: AxiosResponse<T>,
  code?: string,
): AxiosError<T> {
  const error = new Error(message) as AxiosError<T>;
  error.name = 'AxiosError';
  error.config = config;
  error.response = response;
  error.code = code;
  error.isAxiosError = true;
  return error;
}

async function applyRequestInterceptors(
  config: AxiosRequestConfig,
  handlers: Array<{onFulfilled?: FulfilledHandler<AxiosRequestConfig>; onRejected?: RejectedHandler<AxiosRequestConfig>}>,
) {
  let current = config;
  for (const handler of handlers) {
    if (!handler.onFulfilled) {
      continue;
    }
    try {
      current = await handler.onFulfilled(current);
    } catch (error) {
      if (handler.onRejected) {
        current = await handler.onRejected(error);
        continue;
      }
      throw error;
    }
  }
  return current;
}

async function applyResponseInterceptors<T>(
  responsePromise: Promise<AxiosResponse<T>>,
  handlers: Array<{onFulfilled?: FulfilledHandler<AxiosResponse<T>>; onRejected?: RejectedHandler<AxiosResponse<T> | never>}>,
) {
  let chain = responsePromise;
  handlers.forEach(handler => {
    chain = chain.then(
      value => handler.onFulfilled ? handler.onFulfilled(value) as Promise<AxiosResponse<T>> : value,
      error => {
        if (handler.onRejected) {
          return handler.onRejected(error) as Promise<AxiosResponse<T>>;
        }
        return Promise.reject(error);
      },
    );
  });
  return chain;
}

function createAxiosInstance(defaults: AxiosRequestConfig = {}): AxiosLike {
  const requestInterceptors = createInterceptorManager<AxiosRequestConfig>();
  const responseInterceptors = createInterceptorManager<AxiosResponse>();

  const instance: AxiosLike = {
    defaults: {...defaults},
    interceptors: {
      request: requestInterceptors,
      response: responseInterceptors,
    },
    async request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
      const mergedConfig = await applyRequestInterceptors(
        {
          ...instance.defaults,
          ...config,
          headers: {
            ...normalizeHeaders(instance.defaults.headers),
            ...normalizeHeaders(config.headers),
          },
        },
        requestInterceptors.handlers,
      );

      mergedConfig.cancelToken?.throwIfRequested?.();

      const requestUrl = combineUrls(mergedConfig.baseURL, mergedConfig.url);
      const method = (mergedConfig.method ?? 'get').toUpperCase();

      const coreRequest = (async () => {
        try {
          const result = isElectronLocalWebServerRegister(requestUrl, method)
            ? await (async () => {
                const response = await getHostBridge().localWebServer.register(
                  (mergedConfig.data as Record<string, unknown>) ?? {},
                );
                return {
                  data: response.data as T,
                  status: response.status,
                  statusText: response.status === 200 ? 'OK' : 'Bad Request',
                  headers: {'content-type': 'application/json'},
                  url: requestUrl,
                };
              })()
            : await getHostBridge().http.request<T>({
                url: requestUrl,
                method,
                headers: normalizeHeaders(mergedConfig.headers),
                params: mergedConfig.params as Record<string, unknown> | undefined,
                data: mergedConfig.data,
                timeout: typeof mergedConfig.timeout === 'number' ? mergedConfig.timeout : undefined,
                responseType: 'json',
              });

          const response: AxiosResponse<T> = {
            data: result.data,
            status: result.status,
            statusText: result.statusText,
            headers: result.headers,
            config: mergedConfig,
            request: {
              url: result.url || requestUrl,
              method,
            },
          };

          if (response.status >= 400) {
            throw createAxiosError(
              `Request failed with status code ${response.status}`,
              mergedConfig,
              response,
              'ERR_BAD_RESPONSE',
            );
          }

          return response;
        } catch (error) {
          if ((error as {__CANCEL__?: boolean})?.__CANCEL__) {
            throw error;
          }
          if ((error as AxiosError).isAxiosError) {
            throw error;
          }
          throw createAxiosError(
            error instanceof Error ? error.message : String(error),
            mergedConfig,
            undefined,
            'ERR_NETWORK',
          );
        }
      })();

      const responsePromise = mergedConfig.cancelToken?.promise
        ? Promise.race([
            coreRequest,
            mergedConfig.cancelToken.promise.then(reason => Promise.reject(reason)),
          ]) as Promise<AxiosResponse<T>>
        : coreRequest;

      return applyResponseInterceptors(responsePromise, responseInterceptors.handlers as never);
    },
    get<T = unknown>(url: string, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, method: 'get'});
    },
    delete<T = unknown>(url: string, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, method: 'delete'});
    },
    head<T = unknown>(url: string, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, method: 'head'});
    },
    options<T = unknown>(url: string, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, method: 'options'});
    },
    post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, data, method: 'post'});
    },
    put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, data, method: 'put'});
    },
    patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      return instance.request<T>({...config, url, data, method: 'patch'});
    },
  };

  return instance;
}

const axiosInstance = createAxiosInstance();

const axios = Object.assign(
  (<T = unknown>(config: AxiosRequestConfig) => axiosInstance.request<T>(config)) as AxiosLike & ((config: AxiosRequestConfig) => Promise<AxiosResponse>),
  axiosInstance,
  {
    create(config?: AxiosRequestConfig) {
      return createAxiosInstance(config);
    },
    CancelToken,
    isCancel(value: unknown) {
      return Boolean((value as {__CANCEL__?: boolean})?.__CANCEL__);
    },
    isAxiosError(value: unknown) {
      return Boolean((value as {isAxiosError?: boolean})?.isAxiosError);
    },
  },
);

export {CancelToken};
export default axios;
