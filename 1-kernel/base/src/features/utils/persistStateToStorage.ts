import {storage} from "../../core";

export const persistStateToStorage = async (stateKey: string, stateChanged: Record<string, any>): Promise<void> => {
    Object.keys(stateChanged).forEach(
        propertyKey => storage.persistStatePropertyValue(stateKey, propertyKey, stateChanged[propertyKey])
    )
}