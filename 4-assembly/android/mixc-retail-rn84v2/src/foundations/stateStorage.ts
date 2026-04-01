import {createMMKV} from 'react-native-mmkv';

const mmkv = createMMKV();

export const stateStorageAdapter = {
  getItem: async (key: string): Promise<any> => {
    const value = mmkv.getString(key);
    if (value === undefined) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
  setItem: async (key: string, value: any): Promise<void> => {
    mmkv.set(key, JSON.stringify(value));
  },
  removeItem: async (key: string): Promise<void> => {
    mmkv.remove(key);
  },
};

export const mmkvInstance = mmkv;
