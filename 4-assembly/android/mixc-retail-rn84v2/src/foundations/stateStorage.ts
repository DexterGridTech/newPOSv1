import {createMMKV} from 'react-native-mmkv';

type StoredValueEnvelope = {
  type: 'null' | 'boolean' | 'number' | 'string' | 'json';
  value: null | boolean | number | string;
};

const STORAGE_NAMESPACE = 'mixc-retail-rn84v2';
const STORAGE_SEPARATOR = '::';
const ENVELOPE_VERSION = 1;
const mmkv = createMMKV({id: STORAGE_NAMESPACE});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const buildStorageKey = (key: string, prefix?: string): string => {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    throw new Error('stateStorage key must not be empty');
  }

  const normalizedPrefix = prefix?.trim();
  return normalizedPrefix
    ? `${normalizedPrefix}${STORAGE_SEPARATOR}${normalizedKey}`
    : normalizedKey;
};

const encodeValue = (value: unknown): string => {
  const envelope: StoredValueEnvelope =
    value === null
      ? {type: 'null', value: null}
      : typeof value === 'boolean'
        ? {type: 'boolean', value}
        : typeof value === 'number'
          ? {type: 'number', value}
          : typeof value === 'string'
            ? {type: 'string', value}
            : {type: 'json', value: JSON.stringify(value)};

  return JSON.stringify({v: ENVELOPE_VERSION, ...envelope});
};

const decodeEnvelopeValue = (rawValue: string): unknown => {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsed) || parsed.v !== ENVELOPE_VERSION || typeof parsed.type !== 'string') {
      return JSON.parse(rawValue);
    }

    switch (parsed.type) {
      case 'null':
        return null;
      case 'boolean':
      case 'number':
      case 'string':
        return parsed.value;
      case 'json':
        return typeof parsed.value === 'string' ? JSON.parse(parsed.value) : null;
      default:
        return JSON.parse(rawValue);
    }
  } catch {
    return rawValue;
  }
};

export const stateStorageAdapter = {
  getItem: async (key: string, prefix?: string): Promise<unknown> => {
    const storageKey = buildStorageKey(key, prefix);
    const rawValue = mmkv.getString(storageKey);
    if (rawValue === undefined) {
      return null;
    }
    return decodeEnvelopeValue(rawValue);
  },
  setItem: async (key: string, value: unknown, prefix?: string): Promise<void> => {
    const storageKey = buildStorageKey(key, prefix);

    if (value === undefined) {
      mmkv.remove(storageKey);
      return;
    }

    mmkv.set(storageKey, encodeValue(value));
  },
  removeItem: async (key: string, prefix?: string): Promise<void> => {
    const storageKey = buildStorageKey(key, prefix);
    mmkv.remove(storageKey);
  },
};

export const mmkvInstance = mmkv;
