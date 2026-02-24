import {PayloadAction} from "@reduxjs/toolkit";
import {PERSIST_KEY} from "./persistKey";

const isValidSyncValue = (value: any): boolean =>
    value && typeof value === 'object' && typeof value.updatedAt === 'number' && !isNaN(value.updatedAt)

export const batchUpdateState = (state: any, action: PayloadAction<Record<string, any>>) => {
    Object.keys(action.payload).forEach(key => {
        if (key === PERSIST_KEY) return
        const newValue = action.payload[key]
        if (newValue === undefined || newValue === null) {
            delete state[key]
        } else if (isValidSyncValue(newValue)) {
            const localValue = state[key]
            if (!localValue || !isValidSyncValue(localValue) || localValue.updatedAt < newValue.updatedAt) {
                state[key] = newValue
            }
        }
    })
}