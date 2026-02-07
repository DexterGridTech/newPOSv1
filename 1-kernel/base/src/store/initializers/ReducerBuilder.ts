import {Reducer} from "@reduxjs/toolkit";
import {generateUnitDataSlice, unitDataGroups} from "../../features";
import {IReducerBuilder, KernelModule} from "../types";
import {persistReducer} from 'redux-persist';
import {getStatesToPersist, logger, storage} from "../../core";
import {LOG_TAGS, moduleName} from "../../types";

/**
 * Reducer 构建器实现
 * 职责: 负责构建和合并所有 Reducers，并根据配置进行持久化处理
 */
export class ReducerBuilder implements IReducerBuilder {
    async buildReducers(standAlone: boolean, modules: KernelModule[], currentWorkspace: string): Promise<Record<string, Reducer>> {
        // 构建基础 UnitData Reducers
        let rootReducer: Record<string, Reducer> = Object.fromEntries(
            Array.from(unitDataGroups).map(group => [group, generateUnitDataSlice(group)])
        );

        // 合并模块 Reducers
        modules.forEach(module => {
            rootReducer = {...rootReducer, ...module.reducers};
        });

        const reduxStorage = (standAlone ? storage.getReduxStorage() : undefined) ?? {
            getItem: async () => {
                return null;
            },
            setItem: async () => {
            },
            removeItem: async () => {
            },
        }


        // 如果storage不为空并且是standAlone模式（主机非副屏），对需要持久化的 state 进行包装
        const dataVersion = await storage.getDataVersion()
        const statesToPersist = getStatesToPersist();

        logger.debug([moduleName, LOG_TAGS.Store, 'ReducerBuilder'], `Applying persistence with workspace:${currentWorkspace}`, {
            dataVersion,
            statesToPersist: statesToPersist.join(',')
        });

        // 遍历需要持久化的 state
        statesToPersist.forEach(stateName => {
            // 检查该 state 是否存在于 rootReducer 中
            if (rootReducer[stateName]) {
                // 创建持久化配置
                const persistConfig = {
                    key: `${currentWorkspace}-${dataVersion}-${stateName}`,
                    storage: reduxStorage,
                };
                // 使用 persistReducer 包装原始 reducer
                rootReducer[stateName] = persistReducer(persistConfig, rootReducer[stateName]);
                logger.debug([moduleName, LOG_TAGS.Store, 'ReducerBuilder'], `Persisted state: ${stateName}`);
            } else {
                logger.warn([moduleName, LOG_TAGS.Store, 'ReducerBuilder'], `State "${stateName}" marked for persistence but not found in reducers`);
            }
        });
        logger.log([moduleName, LOG_TAGS.Store, 'ReducerBuilder'], 'Persistence applied successfully', {
            totalReducers: Object.keys(rootReducer).length,
            persistedReducers: statesToPersist.length
        });

        return rootReducer;
    }
}
