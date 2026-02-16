import {RootState} from "../moduleState";
import {storeEntry} from "./storeEntry";
import {ValueWithUpdateAt} from "../shared/valueWithUpdateAt";

export abstract class KeyValue<T> {
    readonly stateName: keyof RootState;
    readonly key: string;
    readonly name: string;
    readonly defaultValue: T;

    protected constructor(stateName: keyof RootState, name: string, key: string, defaultValue: T) {
        this.stateName = stateName;
        this.name = name;
        this.key = key;
        this.defaultValue = defaultValue;
    }

    get value(): T {
        const state = storeEntry.getStateByKey(this.stateName) as Record<string, ValueWithUpdateAt<T>>;
        return (state[this.key]?.value) ?? this.defaultValue;
    }
}






