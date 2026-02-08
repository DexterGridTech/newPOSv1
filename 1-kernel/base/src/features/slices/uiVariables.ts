import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {registerStateToPersist, registerStateToSync} from "../../core/store";
import {InstanceInfo} from "../../types/state";
import {generateUiVariableKey} from "../../core/uiVariable";
import {KernelBaseStateNames} from "../../types/stateNames";
import {UiVariablesState} from "../../types/state";

export type {UiVariablesState}

const initialState: UiVariablesState = {}

export const uiVariablesSlice = createSlice({
    name: KernelBaseStateNames.uiVariables,
    initialState,
    reducers: {
        update: (state, action: PayloadAction<{instance:InstanceInfo,uiVariables: { [key: string]: any } }>) => {
            const instance=action.payload.instance
            Object.keys(action.payload.uiVariables).forEach(key=>{
                const fullKey = generateUiVariableKey(key, instance.instanceMode, instance.displayMode);
                state[fullKey] = action.payload.uiVariables[key];
            })
        }
    }
})

export const uiVariablesActions = uiVariablesSlice.actions

registerStateToSync(KernelBaseStateNames.uiVariables)
registerStateToPersist(KernelBaseStateNames.uiVariables)
