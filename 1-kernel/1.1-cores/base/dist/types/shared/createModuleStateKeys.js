/**
 * 创建模块状态键的工厂函数
 */
export function createModuleStateKeys(module, keys) {
    return keys.reduce((acc, key) => {
        acc[key] = `${module}.${key}`;
        return acc;
    }, {});
}
