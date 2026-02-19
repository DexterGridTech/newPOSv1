import {RuntimeConfig} from './types';

export interface ServerConfig {
  port: number;
  basePath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 8888,
  basePath: '/mockMasterServer',
  logLevel: 'info',
};

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  tokenExpireTime: 5 * 60 * 1000,
  heartbeatInterval: 30 * 1000,
  heartbeatTimeout: 60 * 1000,
  retryCacheTimeout: 30 * 1000,
};

export function mergeServerConfig(custom?: Partial<ServerConfig>): ServerConfig {
  return {...DEFAULT_SERVER_CONFIG, ...custom};
}

export function mergeRuntimeConfig(custom?: Partial<RuntimeConfig>): RuntimeConfig {
  return {...DEFAULT_RUNTIME_CONFIG, ...custom};
}
