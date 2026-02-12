import {kernelCoreBaseState, KeyValue} from "../types";

export class DefinedSystemParameter<T> extends KeyValue<T> {
    constructor(
        name: string,
        key: string,
        defaultValue: T
    ) {
        super(kernelCoreBaseState.systemParameters, name, key, defaultValue);
    }
}
