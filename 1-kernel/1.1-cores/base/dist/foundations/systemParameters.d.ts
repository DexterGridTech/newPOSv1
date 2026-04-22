import { KeyValue } from "../types/foundations/keyValue";
export declare const registerModuleSystemParameter: (_moduleName: string, systemParameters: DefinedSystemParameter<any>[]) => void;
export declare const getSystemParameterByKey: (key: string) => DefinedSystemParameter<any>;
export declare class DefinedSystemParameter<T> extends KeyValue<T> {
    constructor(name: string, key: string, defaultValue: T);
}
//# sourceMappingURL=systemParameters.d.ts.map