/**
 * 参数校验工具
 */
/**
 * 检查必需字段
 */
export function validateRequired(obj, fields) {
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
export function validateType(value, expectedType, fieldName) {
    const actualType = typeof value;
    if (actualType !== expectedType) {
        return `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`;
    }
    return null;
}
/**
 * 检查枚举值
 */
export function validateEnum(value, enumObj, fieldName) {
    const validValues = Object.values(enumObj);
    if (!validValues.includes(value)) {
        return `Field '${fieldName}' must be one of: ${validValues.join(', ')}`;
    }
    return null;
}
/**
 * 检查字符串长度
 */
export function validateLength(value, min, max, fieldName) {
    if (value.length < min || value.length > max) {
        return `Field '${fieldName}' length must be between ${min} and ${max}`;
    }
    return null;
}
/**
 * 检查JSON格式
 */
export function validateJSON(value, fieldName) {
    try {
        JSON.parse(value);
        return null;
    }
    catch (e) {
        return `Field '${fieldName}' must be valid JSON`;
    }
}
/**
 * 检查唯一性键格式(只允许字母、数字、下划线、中划线)
 */
export function validateKey(value, fieldName) {
    const keyRegex = /^[a-zA-Z0-9_-]+$/;
    if (!keyRegex.test(value)) {
        return `Field '${fieldName}' can only contain letters, numbers, underscores and hyphens`;
    }
    return null;
}
//# sourceMappingURL=validator.js.map