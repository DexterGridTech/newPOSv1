/**
 * 创建模块状态键的工厂函数
 */
export function createModuleStateKeys<T extends readonly string[]>(
    module: string,
    keys: T
): { [K in T[number]]: string } {
    return keys.reduce((acc, key) => {
        acc[key] = `${module}.${key}`;
        return acc;
    }, {} as any);
}