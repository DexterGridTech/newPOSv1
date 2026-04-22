/**
 * 初始化日志工具类
 */
export declare class InitLogger {
    private static instance;
    static getInstance(): InitLogger;
    private static readonly COLORS;
    private startTime;
    private colorize;
    logBanner(): void;
    logStep(step: number, title: string): void;
    logStepEnd(): void;
    logDetail(label: string, value: string | number | boolean): void;
    logModule(module: any, index: number, total: number): void;
    logNames(names: string[]): void;
    logSuccess(message: string): void;
    logSummary(allModules: any[]): void;
    private formatSummaryLine;
    private padRight;
}
//# sourceMappingURL=initLogger.d.ts.map