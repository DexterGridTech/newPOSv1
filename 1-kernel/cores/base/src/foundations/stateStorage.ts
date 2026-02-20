export interface Storage {
    getItem(key: string, ...args: Array<any>): any;

    setItem(key: string, value: any, ...args: Array<any>): any;

    removeItem(key: string, ...args: Array<any>): any;
}

let stateStorage: Storage = {
    getItem: async () => null,
    setItem: async () => {
    },
    removeItem: async () => {
    },
}

let stateStoragePrefix = 'default'

export const setStateStorage = (storage: Storage) => {
    stateStorage = storage
}
export const getStateStorage = () => stateStorage

export const setStateStoragePrefix = (prefix: string) => {
    stateStoragePrefix = prefix

}
export const getStateStoragePrefix = () => stateStoragePrefix