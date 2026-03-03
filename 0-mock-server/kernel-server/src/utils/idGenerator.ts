import { generate, createTranslator } from 'short-uuid';

export function generateId(): string {
  return generate();
}

export function generateToken(): string {
  return createTranslator('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz').generate();
}

export function generateActiveCode(): string {
  return generate().slice(0, 12).toUpperCase();
}

export function generateDeactiveCode(): string {
  return generate().slice(0, 12).toUpperCase();
}
