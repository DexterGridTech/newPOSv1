import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from 'lodash';

import {registerStateToPersist, registerStateToSync} from "../../core/specialStateList";


export interface SystemParametersState {
    parameters: {
        [path: string]: {
            id: string,
            key: string,
            value: any,
            updatedAt: number
        }
    }
    updatedAt?: number
}

const initialState: SystemParametersState = {
    parameters: {}
}

export const systemParametersSlice = createSlice(
    {
        name: 'systemParameters',
        initialState,
        reducers: {
            setParameters: (state, action: PayloadAction<{ [path: string]: any }>) => {
                state.parameters = action.payload
                state.updatedAt = now()
            }
        }
    }
)

export const systemParametersActions = systemParametersSlice.actions

registerStateToSync(systemParametersSlice.name)
registerStateToPersist(systemParametersSlice.name)