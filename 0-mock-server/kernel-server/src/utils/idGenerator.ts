/**
 * ID生成器
 */

import { customAlphabet } from 'nanoid';

/**
 * 生成UUID格式的ID
 */
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return nanoid();
}

/**
 * 生成token
 */
export function generateToken(): string {
  return customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32)();
}

/**
 * 生成激活码
 */
export function generateActiveCode(): string {
  return customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12)();
}

/**
 * 生成解绑码
 */
export function generateDeactiveCode(): string {
  return customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12)();
}
