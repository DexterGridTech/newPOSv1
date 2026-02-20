import { IStorageAdapter } from '@impos2/kernel-base';
import { MMKV } from 'react-native-mmkv';
import { Storage } from 'redux-persist';

/**
 * StorageAdapter 实现类
 * 使用 react-native-mmkv 实现存储功能
 */
export class StorageAdapterImpl implements IStorageAdapter {
  private mmkv: MMKV;

  constructor() {
    // 初始化 MMKV 实例
    this.mmkv = new MMKV();
  }

  /**
   * 设置键值对
   * @param nameSpace 命名空间
   * @param key 键
   * @param value 值
   */
  async setItem<T>(nameSpace: string, key: string, value: T): Promise<void> {
    const fullKey = `${nameSpace}:${key}`;
    const jsonValue = JSON.stringify(value);
    this.mmkv.set(fullKey, jsonValue);
  }

  /**
   * 获取键值
   * @param nameSpace 命名空间
   * @param key 键
   * @returns 值或 null
   */
  async getItem<T>(nameSpace: string, key: string): Promise<T | null> {
    const fullKey = `${nameSpace}:${key}`;
    const jsonValue = this.mmkv.getString(fullKey);
    
    if (jsonValue === undefined) {
      return null;
    }
    
    try {
      return JSON.parse(jsonValue) as T;
    } catch (error) {
      console.error(`Failed to parse value for key ${fullKey}:`, error);
      return null;
    }
  }

  /**
   * 删除键值对
   * @param nameSpace 命名空间
   * @param key 键
   */
  async removeItem(nameSpace: string, key: string): Promise<void> {
    const fullKey = `${nameSpace}:${key}`;
    this.mmkv.delete(fullKey);
  }

  /**
   * 获取 Redux Persist 使用的 Storage 对象
   * 用于 Redux 数据持久化
   */
  getStorage(): Storage {
    return {
      setItem: (key: string, value: string) => {
        this.mmkv.set(key, value);
        return Promise.resolve();
      },
      getItem: (key: string) => {
        const value = this.mmkv.getString(key);
        return Promise.resolve(value ?? null);
      },
      removeItem: (key: string) => {
        this.mmkv.delete(key);
        return Promise.resolve();
      },
    };
  }
}

// 导出单例实例
export const storageAdapter = new StorageAdapterImpl();
