export function createModuleInstanceModeStateKeys(moduleName, keys) {
    return keys.reduce((acc, key) => {
        acc[key] = `${moduleName}.${key}`;
        return acc;
    }, {});
}
