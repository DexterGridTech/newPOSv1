export declare class Logger {
    private level;
    private prefix;
    constructor(prefix?: string, logLevel?: 'debug' | 'info' | 'warn' | 'error');
    private fmt;
    debug(msg: string, ...args: any[]): void;
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
}
//# sourceMappingURL=Logger.d.ts.map