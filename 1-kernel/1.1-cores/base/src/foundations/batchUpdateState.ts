import {PayloadAction} from "@reduxjs/toolkit";

const isValidSyncValue = (value: any): boolean =>
    value && typeof value === 'object' && typeof value.updateAt === 'number' && !isNaN(value.updateAt)

export const batchUpdateState = (state: any, action: PayloadAction<Record<string, any>>) => {
    Object.keys(action.payload).forEach(key => {
        const newValue = action.payload[key]
        if (newValue === undefined || newValue === null) {
            delete state[key]
        } else if (isValidSyncValue(newValue)) {
            const localValue = state[key]
            if (!localValue || !isValidSyncValue(localValue) || localValue.updateAt < newValue.updateAt) {
                state[key] = newValue
            }
        }
    })
}