/**
 * 参数校验工具
 */

/**
 * 检查必需字段
 */
export function validateRequired(obj: any, fields: string[]): string | null {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return `Field '${field}' is required`;
    }
  }
  return null;
}

/**
 * 检查字段类型
 */
export function validateType(value: any, expectedType: string, fieldName: string): string | null {
  const actualType = typeof value;
  if (actualType !== expectedType) {
    return `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`;
  }
  return null;
}

/**
 * 检查枚举值
 */
export function validateEnum<T>(value: any, enumObj: any, fieldName: string): string | null {
  const validValues = Object.values(enumObj);
  if (!validValues.includes(value)) {
    return `Field '${fieldName}' must be one of: ${validValues.join(', ')}`;
  }
  return null;
}

/**
 * 检查字符串长度
 */
export function validateLength(value: string, min: number, max: number, fieldName: string): string | null {
  if (value.length < min || value.length > max) {
    return `Field '${fieldName}' length must be between ${min} and ${max}`;
  }
  return null;
}

/**
 * 检查JSON格式
 */
export function validateJSON(value: string, fieldName: string): string | null {
  try {
    JSON.parse(value);
    return null;
  } catch (e) {
    return `Field '${fieldName}' must be valid JSON`;
  }
}

/**
 * 检查唯一性键格式(只允许字母、数字、下划线、中划线)
 */
export function validateKey(value: string, fieldName: string): string | null {
  const keyRegex = /^[a-zA-Z0-9_-]+$/;
  if (!keyRegex.test(value)) {
    return `Field '${fieldName}' can only contain letters, numbers, underscores and hyphens`;
  }
  return null;
}
