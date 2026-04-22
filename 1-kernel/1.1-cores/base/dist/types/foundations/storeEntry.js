import { stateStorage } from "../../foundations/adapters/stateStorage";
class StoreEntryImpl {
    store = null;
    environment = null;
    serverSpace = null;
    setStore(store) {
        this.store = store;
    }
    getStore() {
        return this.store;
    }
    getStateByKey(stateKey) {
        if (!this.store) {
            throw new Error('Store is not initialized yet');
        }
        const state = this.store.getState();
        if (!(stateKey in state)) {
            throw new Error(`State key '${stateKey}' does not exist`);
        }
        return state[stateKey];
    }
    getState() {
        if (!this.store) {
            throw new Error('Store is not initialized yet');
        }
        return this.store.getState();
    }
    dispatchAction(action) {
        if (!this.store) {
            throw new Error('Store is not initialized yet');
        }
        this.store.dispatch(action);
    }
    setEnvironment(env) {
        this.environment = env;
    }
    getEnvironment() {
        if (!this.environment)
            throw new Error('Environment not initialized');
        return this.environment;
    }
    setServerSpace(serverSpace) {
        this.serverSpace = serverSpace;
    }
    getServerSpace() {
        if (!this.serverSpace)
            throw new Error('ServerSpace not initialized');
        return this.serverSpace;
    }
    async getDataVersion() {
        return await stateStorage.getItem(`DataVersion-${this.getServerSpace().selectedSpace}`) ?? 0;
    }
    async setDataVersion(version) {
        await stateStorage.setItem(`DataVersion-${this.getServerSpace().selectedSpace}`, version);
    }
    async setSelectServerSpace(selectedSpace) {
        await stateStorage.setItem('SelectedServerSpace', selectedSpace);
    }
    async getSelectServerSpace() {
        return stateStorage.getItem('SelectedServerSpace');
    }
}
// 导出单例实例，供其他 package 扩展和使用
export const storeEntry = new StoreEntryImpl();
