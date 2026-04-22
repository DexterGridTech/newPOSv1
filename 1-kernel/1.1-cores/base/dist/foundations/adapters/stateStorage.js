export const stateStorage = {
    getItem: async (key, ...args) => {
        return registeredStorage?.getItem(key, ...args);
    },
    setItem: async (key, value, ...args) => {
        await registeredStorage?.setItem(key, value, ...args);
    },
    removeItem: async (key, ...args) => {
        await registeredStorage?.removeItem(key, ...args);
    },
};
let registeredStorage = null;
let stateStoragePrefix = 'default';
export const registerStateStorage = (storage) => {
    registeredStorage = storage;
};
export const setStateStoragePrefix = (prefix) => {
    stateStoragePrefix = prefix;
};
export const getStateStoragePrefix = () => stateStoragePrefix;
