import { storeEntry } from "./storeEntry";
export class KeyValue {
    stateName;
    key;
    name;
    defaultValue;
    constructor(stateName, name, key, defaultValue) {
        this.stateName = stateName;
        this.name = name;
        this.key = key;
        this.defaultValue = defaultValue;
    }
    get value() {
        const state = storeEntry.getStateByKey(this.stateName);
        return (state[this.key]?.value) ?? this.defaultValue;
    }
}
