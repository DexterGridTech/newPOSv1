import {format} from 'date-fns';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = '', logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.prefix = prefix;
    this.level = LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private fmt(level: string, message: string): string {
    const ts = format(new Date(), 'yyyy-M-d HH:mm:ss SSS');
    return `${ts} [${level}] ${this.prefix ? `[${this.prefix}] ` : ''}${message}`;
  }

  debug(msg: string, ...args: any[]) { if (this.level <= LogLevel.DEBUG) console.debug(this.fmt('DEBUG', msg), ...args); }
  info(msg: string, ...args: any[]) { if (this.level <= LogLevel.INFO) console.info(this.fmt('INFO', msg), ...args); }
  warn(msg: string, ...args: any[]) { if (this.level <= LogLevel.WARN) console.warn(this.fmt('WARN', msg), ...args); }
  error(msg: string, ...args: any[]) { if (this.level <= LogLevel.ERROR) console.error(this.fmt('ERROR', msg), ...args); }
}
