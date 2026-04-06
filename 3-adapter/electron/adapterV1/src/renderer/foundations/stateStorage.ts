import type {StateStorage} from '@impos2/kernel-core-base';
import {getHostBridge} from './hostBridge';

export const stateStorageAdapter: StateStorage = {
  getItem: (key: string, ...args: unknown[]) => getHostBridge().stateStorage.getItem(key, ...args),
  setItem: (key: string, value: unknown, ...args: unknown[]) =>
    getHostBridge().stateStorage.setItem(key, value, ...args),
  removeItem: (key: string, ...args: unknown[]) => getHostBridge().stateStorage.removeItem(key, ...args),
};
