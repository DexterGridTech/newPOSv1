export interface StateStorage {
    getItem(key: string, ...args: Array<any>): Promise<any>;

    setItem(key: string, value: any, ...args: Array<any>): Promise<void>;

    removeItem(key: string, ...args: Array<any>): Promise<void>;
}

export const stateStorage: StateStorage = {
    getItem: async (key: string, ...args: Array<any>) => {
        return registeredStorage?.getItem(key, ...args)
    },
    setItem: async (key: string, value: any, ...args: Array<any>) => {
        await registeredStorage?.setItem(key, value, ...args)
    },
    removeItem: async (key: string, ...args: Array<any>) => {
        await registeredStorage?.removeItem(key, ...args)
    },
}
let registeredStorage: StateStorage|null=null

let stateStoragePrefix = 'default'

export const registerStateStorage=(storage: StateStorage)=>{
    registeredStorage=storage
}
export const setStateStoragePrefix = (prefix: string) => {
    stateStoragePrefix = prefix
}
export const getStateStoragePrefix = () => stateStoragePrefix