import * as shortUuidNamespace from 'short-uuid';

type ShortUuidModule = {
  constants?: Record<string, string>;
  createTranslator?: (...args: unknown[]) => unknown;
  generate?: () => string;
};

const normalizedModule = (
  (shortUuidNamespace as unknown as {default?: ShortUuidModule}).default
  ?? (shortUuidNamespace as unknown as ShortUuidModule)
) as ShortUuidModule;

const fallbackGenerate = () =>
  globalThis.crypto?.randomUUID?.().replace(/-/g, '') ?? `${Date.now()}${Math.random().toString(36).slice(2)}`;

export const constants = normalizedModule.constants ?? {};

export const createTranslator = normalizedModule.createTranslator
  ? normalizedModule.createTranslator.bind(normalizedModule)
  : ((..._args: unknown[]) => ({
      generate: fallbackGenerate,
      new: fallbackGenerate,
      uuid: () => globalThis.crypto?.randomUUID?.() ?? fallbackGenerate(),
      fromUUID: (value: string) => value,
      toUUID: (value: string) => value,
      validate: () => true,
      alphabet: '',
      maxLength: 0,
    }));

export const generate = normalizedModule.generate
  ? normalizedModule.generate.bind(normalizedModule)
  : fallbackGenerate;

const shortUuidCompat = {
  constants,
  createTranslator,
  generate,
};

export default shortUuidCompat;
