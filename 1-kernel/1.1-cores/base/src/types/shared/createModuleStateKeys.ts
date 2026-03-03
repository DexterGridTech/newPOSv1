/**
 * 创建模块状态键的工厂函数
 */
export function createModuleStateKeys<M extends string, T extends readonly string[]>(
    module: M,
    keys: T
): { [K in T[number]]: `${M}.${K}` } {
    return keys.reduce((acc, key) => {
        acc[key] = `${module}.${key}`;
        return acc;
    }, {} as any);
}