import {PayloadAction, Slice, SliceCaseReducers, ValidateSliceCaseReducers} from "@reduxjs/toolkit";

/**
 * 从 slice.actions 中提取类型安全的 actions，避免 TS4023 错误
 * 用于解决动态索引类型（Record<string, T>）导致的 Immer 内部类型暴露问题
 *
 * @example
 * ```ts
 * const slice = createSlice({
 *   name: 'order',
 *   initialState: {} as OrderState,
 *   reducers: {
 *     addOrder: (state, action: PayloadAction<Order>) => { ... },
 *     updateOrder: (state, action: PayloadAction<Order>) => { ... }
 *   }
 * })
 *
 * export const orderActions = extractSliceActions(slice.actions)
 * ```
 */
export function extractSliceActions<
    State,
    CR extends SliceCaseReducers<State>,
    Name extends string = string
>(
    actions: Slice<State, CR, Name>['actions']
): {
    [K in keyof CR]: CR[K] extends (state: State, action: infer A) => any
        ? A extends PayloadAction<infer P>
            ? (payload: P) => PayloadAction<P>
            : () => PayloadAction<undefined>
        : never
} {
    return actions as any
}
