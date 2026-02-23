import {async} from "rxjs";

export interface Storage {
    getItem(key: string, ...args: Array<any>): Promise<any>;

    setItem(key: string, value: any, ...args: Array<any>): Promise<void>;

    removeItem(key: string, ...args: Array<any>): Promise<void>;
}

export const stateStorage: Storage = {
    getItem: async (key: string, ...args: Array<any>) => {
        return registeredStorage?.getItem(key, ...args)
    },
    setItem: async (key: string, value: any, ...args: Array<any>) => {
        registeredStorage?.setItem(key, value, ...args)
    },
    removeItem: async (key: string, ...args: Array<any>) => {
        registeredStorage?.removeItem(key, ...args)
    },
}
let registeredStorage: Storage|null=null

let stateStoragePrefix = 'default'

export const registerStateStorage=(storage: Storage)=>{
    registeredStorage=storage
}
export const setStateStoragePrefix = (prefix: string) => {
    stateStoragePrefix = prefix
}
export const getStateStoragePrefix = () => stateStoragePrefix