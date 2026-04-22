/**
 * API 请求类
 * 封装单个 API 请求的执行和取消
 */
import { HttpMethod, RequestWrapper, ResponseWrapper } from '../../types/shared/http';
/**
 * API 类
 */
export declare class Api<T, R> {
    private readonly _serverName;
    private readonly _path;
    private readonly _method;
    private cancelTokenSource?;
    constructor(serverName: string, path: string, method: HttpMethod);
    serverName: () => string;
    path: () => string;
    run(requestWrapper: RequestWrapper<T>, timeout?: number): Promise<ResponseWrapper<R>>;
    /**
     * 取消请求
     */
    cancel(reason?: string): void;
}
//# sourceMappingURL=Api.d.ts.map