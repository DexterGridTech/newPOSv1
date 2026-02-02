import {Middleware, PayloadAction} from "@reduxjs/toolkit";
import {ActionMeta, AppAction, IStoreAccessor} from "../types";
import {ICommand} from "./command";
import diff from "deep-diff";
import {logger} from "./nativeAdapter";

let _storeAccessor: IStoreAccessor | null = null;

/**
 * 设置store访问器 - 由store模块在初始化时调用
 */
export const setStoreAccessor = (accessor: IStoreAccessor) => {
    _storeAccessor = accessor;
};

const traceActionFromCommand = (
    action: PayloadAction<any>,
    command?: ICommand<any>
) => {
    const meta: ActionMeta = {
        commandId:command?.id ?? "unknown",
        requestId:command?.requestId ?? "unknown",
        sessionId:command?.sessionId ?? "unknown",
        addedAt: Date.now(),
    };

    return {
        ...action,
        meta,
    };
};

export const dispatchAction = (action: PayloadAction<any>, command?: ICommand<any>) => {
    if (!_storeAccessor) {
        throw new Error("StoreAccessor not initialized. Call setStoreAccessor first.");
    }
    _storeAccessor.dispatch(traceActionFromCommand(action, command));
}
export const dispatchSimpleAction = (action: PayloadAction<any>) => {
    if (!_storeAccessor) {
        throw new Error("StoreAccessor not initialized. Call setStoreAccessor first.");
    }
    _storeAccessor.dispatch(action);
}


export const currentState= <S>(): S => {
    if (!_storeAccessor) {
        throw new Error("StoreAccessor not initialized. Call setStoreAccessor first.");
    }
    return _storeAccessor.getState() as S;
}

export const createTraceMiddleware = (): Middleware => {
    let prevState: any; // 保存上一次的状态

    return ({getState}) => (next) => (action: unknown) => {

        const traceAction = action as AppAction<any>;
        const currentState = getState();
        if (!prevState) prevState = currentState;

        const trace = traceAction.meta;
        // 执行Action,获取新状态
        const result = next(action);
        const nextState = getState();
        // 只对变化的 slice 进行 diff
        const changedSlices: string[] = [];
        for (const key in nextState) {
            // @ts-ignore
            if (prevState[key] !== nextState[key]) {
                changedSlices.push(key);
            }
        }
        if (changedSlices.length > 0) {
            const diffs = diff(prevState, nextState) ?? [];
            if (diffs.length > 0)
                logger.debug('dispatch action->',traceAction.type, trace, diffs);
        }
        prevState = nextState;
        return result;
    };
};
