import type {Logger} from '@impos2/kernel-core-base';
import NativeLoggerTurboModule from '../supports/apis/NativeLoggerTurboModule';

export interface LogFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
}

export class LoggerAdapter implements Logger {
  debug(tags: string[], message: string, data?: any): void {
    NativeLoggerTurboModule.debug(tags.join('.'), this.buildMessage(message, data));
  }

  log(tags: string[], message: string, data?: any): void {
    NativeLoggerTurboModule.log(tags.join('.'), this.buildMessage(message, data));
  }

  warn(tags: string[], message: string, data?: any): void {
    NativeLoggerTurboModule.warn(tags.join('.'), this.buildMessage(message, data));
  }

  error(tags: string[], message: string, data?: any): void {
    NativeLoggerTurboModule.error(tags.join('.'), this.buildMessage(message, data));
  }

  getLogFiles(): Promise<LogFile[]> {
    return NativeLoggerTurboModule.getLogFiles() as Promise<LogFile[]>;
  }

  getLogContent(fileName: string): Promise<string> {
    return NativeLoggerTurboModule.getLogContent(fileName, 1024 * 1024);
  }

  deleteLogFile(fileName: string): Promise<boolean> {
    return NativeLoggerTurboModule.deleteLogFile(fileName);
  }

  clearAllLogs(): Promise<boolean> {
    return NativeLoggerTurboModule.clearAllLogs();
  }

  getLogDirPath(): Promise<string> {
    return NativeLoggerTurboModule.getLogDirPath();
  }

  private buildMessage(message: string, data?: any): string {
    if (data == null) return message;
    if (data instanceof Error) return `${message} | ${data.name}: ${data.message}`;
    if (typeof data === 'string') return `${message} | ${data}`;
    try {
      return `${message} | ${JSON.stringify(data)}`;
    } catch {
      return `${message} | [unserializable-data]`;
    }
  }
}

export const loggerAdapter = new LoggerAdapter();
