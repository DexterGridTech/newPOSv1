import {PayloadAction} from "@reduxjs/toolkit";

export const batchUpdateState = (state: any, action: PayloadAction<Record<string, any>>) => {
    Object.keys(action.payload).forEach(key => {
        const newValue = action.payload[key]
        if (newValue === undefined || newValue === null) {
            delete state[key]
        } else {
            state[key] = newValue
        }
    })
}