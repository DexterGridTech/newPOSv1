import {AppAction} from "./action";

/**
 * Store访问器接口,用于解耦 foundations 和 store 之间的循环依赖
 */
export interface IStoreAccessor<S = any> {
    /**
     * 获取当前状态
     */
    getState(): S;
    /**
     * 分发action
     */
    dispatch(action: AppAction<any>): void;
}
