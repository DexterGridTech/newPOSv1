import { format } from 'date-fns';
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    level;
    prefix;
    constructor(prefix = '', logLevel = 'info') {
        this.prefix = prefix;
        this.level = LogLevel[logLevel.toUpperCase()] ?? LogLevel.INFO;
    }
    fmt(level, message) {
        const ts = format(new Date(), 'yyyy-M-d HH:mm:ss SSS');
        return `${ts} [${level}] ${this.prefix ? `[${this.prefix}] ` : ''}${message}`;
    }
    debug(msg, ...args) { if (this.level <= LogLevel.DEBUG)
        console.debug(this.fmt('DEBUG', msg), ...args); }
    info(msg, ...args) { if (this.level <= LogLevel.INFO)
        console.info(this.fmt('INFO', msg), ...args); }
    warn(msg, ...args) { if (this.level <= LogLevel.WARN)
        console.warn(this.fmt('WARN', msg), ...args); }
    error(msg, ...args) { if (this.level <= LogLevel.ERROR)
        console.error(this.fmt('ERROR', msg), ...args); }
}
//# sourceMappingURL=Logger.js.map