import {RootState} from "../moduleState";
import {storeEntry} from "./storeEntry";
import {ValueWithUpdatedAt} from "../shared/valueWithUpdatedAt";

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
        const state = storeEntry.getStateByKey(this.stateName) as Record<string, ValueWithUpdatedAt<T>>;
        return (state[this.key]?.value) ?? this.defaultValue;
    }
}






