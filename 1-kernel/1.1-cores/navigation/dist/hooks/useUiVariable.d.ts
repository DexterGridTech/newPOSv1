import { RootState } from "@impos2/kernel-core-base";
export interface UiVariable<T> {
    key: string;
    defaultValue: T;
}
/**
 * 非 hook 的 selector，可在 hook 外部直接调用
 */
export declare function selectUiVariable<T>(state: RootState, key: string, defaultValue: T): T;
export declare function useEditableUiVariable<T>(variable: UiVariable<T>): {
    value: T;
    setValue: (value: T) => void;
};
//# sourceMappingURL=useUiVariable.d.ts.map