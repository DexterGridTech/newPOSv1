import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {UnitDataState} from "../../types/state/unitData";
import {UnitDataChangedSet} from "../../types/shared/unitData";
import {ModuleSliceConfig} from "@impos2/kernel-core-base";

export const generateUnitDataSliceConfig = (groupName: string) => {
    const initialState: UnitDataState = {}
    const slice = createSlice({
        name: groupName,
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
    const unitDataConfig: ModuleSliceConfig<UnitDataState> = {
        name: groupName,
        reducer: slice.reducer,
        persistToStorage: true,
    }
    return unitDataConfig;
}