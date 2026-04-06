import type {Logger} from '@impos2/kernel-core-base';
import {getHostBridge} from './hostBridge';

export const loggerAdapter: Logger = {
  debug: (tags, message, data) => {
    void getHostBridge().logger.debug(tags, message, data);
  },
  log: (tags, message, data) => {
    void getHostBridge().logger.log(tags, message, data);
  },
  warn: (tags, message, data) => {
    void getHostBridge().logger.warn(tags, message, data);
  },
  error: (tags, message, data) => {
    void getHostBridge().logger.error(tags, message, data);
  },
  getLogFiles: () => getHostBridge().logger.getLogFiles() as ReturnType<Logger['getLogFiles']>,
  getLogContent: (fileName: string) => getHostBridge().logger.getLogContent(fileName),
  deleteLogFile: (fileName: string) => getHostBridge().logger.deleteLogFile(fileName),
  clearAllLogs: () => getHostBridge().logger.clearAllLogs(),
  getLogDirPath: () => getHostBridge().logger.getLogDirPath(),
};
