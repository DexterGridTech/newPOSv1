/**
 * 参数校验工具
 */
/**
 * 检查必需字段
 */
export declare function validateRequired(obj: any, fields: string[]): string | null;
/**
 * 检查字段类型
 */
export declare function validateType(value: any, expectedType: string, fieldName: string): string | null;
/**
 * 检查枚举值
 */
export declare function validateEnum<T>(value: any, enumObj: any, fieldName: string): string | null;
/**
 * 检查字符串长度
 */
export declare function validateLength(value: string, min: number, max: number, fieldName: string): string | null;
/**
 * 检查JSON格式
 */
export declare function validateJSON(value: string, fieldName: string): string | null;
/**
 * 检查唯一性键格式(只允许字母、数字、下划线、中划线)
 */
export declare function validateKey(value: string, fieldName: string): string | null;
//# sourceMappingURL=validator.d.ts.map