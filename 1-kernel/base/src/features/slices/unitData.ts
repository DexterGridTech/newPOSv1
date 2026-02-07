import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {UnitDataChangedSet, UnitDataState} from "../../types";
import {registerStateToPersist} from "../../core/specialStateList";

export const generateUnitDataSlice = (group: string) => {
    const initialState: UnitDataState = {
    }
    const slice = createSlice({
        name: group,
        initialState,
        reducers: {
            updateUnitData: (state, action: PayloadAction<UnitDataChangedSet>) => {
                action.payload.updated.forEach(unitData => {
                    const existedUnitData = state[unitData.id]
                    if (existedUnitData) {
                        Object.assign(existedUnitData, unitData)
                    } else {
                        state[unitData.id] = unitData
                    }
                })
                action.payload.deleted.forEach(id => {
                    delete state[id]
                })
            }
        }
    })
    registerStateToPersist(slice.name)
    return slice.reducer;
}