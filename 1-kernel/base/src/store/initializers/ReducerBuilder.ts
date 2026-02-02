import { Reducer } from "@reduxjs/toolkit";
import { generateUnitDataSlice, unitDataGroups, UnitDataGroupStates } from "../../features";
import { UnitDataState } from "../../types";
import { KernelModule, IReducerBuilder } from "../types";

/**
 * Reducer 构建器实现
 * 职责: 负责构建和合并所有 Reducers
 */
export class ReducerBuilder implements IReducerBuilder {
    buildReducers(modules: KernelModule[]): Record<string, Reducer> {
        // 构建基础 UnitData Reducers
        let rootReducer = Object.fromEntries(
            Array.from(unitDataGroups).map(group => [group, generateUnitDataSlice(group)])
        ) as {
            [K in keyof UnitDataGroupStates]: Reducer<UnitDataState>;
        };

        // 合并模块 Reducers
        modules.forEach(module => {
            rootReducer = { ...rootReducer, ...module.reducers };
        });

        return rootReducer;
    }
}
