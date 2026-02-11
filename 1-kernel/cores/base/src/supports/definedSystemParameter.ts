import {KeyValue,kernelCoreBaseState} from "../types";

export class DefinedSystemParameter<T> extends KeyValue<T> {

    constructor(
        name: string,
        key: string,
        value: T
    ) {
        super(kernelCoreBaseState.systemParameters, name, key, value);
    }
}
