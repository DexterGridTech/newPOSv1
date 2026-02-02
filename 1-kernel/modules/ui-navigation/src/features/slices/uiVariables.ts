import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {registerStateToPersist, registerStateToSync, InstanceInfo} from "@impos2/kernel-base";
import {generateUiVariableKey} from "../../core/uiVariable";

export interface UiVariablesState {
    [key: string]: any;
}

const initialState: UiVariablesState = {}

export const uiVariablesSlice = createSlice({
    name: 'uiVariables',
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

registerStateToSync(uiVariablesSlice.name)
registerStateToPersist(uiVariablesSlice.name)