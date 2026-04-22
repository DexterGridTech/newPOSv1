export interface StateStorage {
    getItem(key: string, ...args: Array<any>): Promise<any>;
    setItem(key: string, value: any, ...args: Array<any>): Promise<void>;
    removeItem(key: string, ...args: Array<any>): Promise<void>;
}
export declare const stateStorage: StateStorage;
export declare const registerStateStorage: (storage: StateStorage) => void;
export declare const setStateStoragePrefix: (prefix: string) => void;
export declare const getStateStoragePrefix: () => string;
//# sourceMappingURL=stateStorage.d.ts.map