import { RootState } from "../moduleState";
export declare abstract class KeyValue<T> {
    readonly stateName: keyof RootState;
    readonly key: string;
    readonly name: string;
    readonly defaultValue: T;
    protected constructor(stateName: keyof RootState, name: string, key: string, defaultValue: T);
    get value(): T;
}
//# sourceMappingURL=keyValue.d.ts.map