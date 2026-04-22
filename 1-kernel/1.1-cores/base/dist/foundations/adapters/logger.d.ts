export interface LogFile {
    fileName: string;
    filePath: string;
    fileSize: number;
    lastModified: number;
}
export interface Logger {
    debug: (tags: string[], message: string, data?: any) => void;
    log: (tags: string[], message: string, data?: any) => void;
    warn: (tags: string[], message: string, data?: any) => void;
    error: (tags: string[], message: string, data?: any) => void;
    getLogFiles: () => Promise<LogFile[]>;
    getLogContent: (fileName: string) => Promise<string>;
    deleteLogFile: (fileName: string) => Promise<boolean>;
    clearAllLogs: () => Promise<boolean>;
    getLogDirPath: () => Promise<string>;
}
export declare const logger: Logger;
export declare const registerLogger: (l: Logger) => number;
//# sourceMappingURL=logger.d.ts.map