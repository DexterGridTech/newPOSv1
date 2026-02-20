import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from 'lodash';

import {registerStateToPersist, registerStateToSync} from "../../core/specialStateList";
import {KernelBaseStateNames} from "../../types/stateNames";
import {SystemParametersState} from "../../types/state";

export type {SystemParametersState}

const initialState: SystemParametersState = {
    parameters: {}
}

export const systemParametersSlice = createSlice(
    {
        name: KernelBaseStateNames.systemParameters,
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

registerStateToSync(KernelBaseStateNames.systemParameters)
registerStateToPersist(KernelBaseStateNames.systemParameters)