import { createStateSyncMiddleware } from "../../core";
import { IMiddlewareConfigurator } from "../types";

/**
 * Middleware 配置器实现
 * 职责: 负责配置所有 Middleware
 */
export class MiddlewareConfigurator implements IMiddlewareConfigurator {
    configureMiddleware(epicMiddleware: any): any[] {
        return [
            createStateSyncMiddleware() as any,
            epicMiddleware as any
        ];
    }
}
