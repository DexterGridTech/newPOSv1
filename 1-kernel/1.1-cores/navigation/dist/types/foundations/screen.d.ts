import { ScreenPart } from "@impos2/kernel-core-base";
export interface ModalScreen<T> {
    id: string;
    screenPartKey: string;
    props?: T;
}
export declare const createModalScreen: <T>(screenPart: ScreenPart<T>, id: string, props: T) => {
    id: string;
    props: T;
    name: string;
    title: string;
    description: string;
    partKey: string;
    containerKey?: string | null;
    indexInContainer?: number | null;
};
export interface AlertInfo {
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    confirmCommandName?: string;
    confirmCommandPayload?: any;
}
//# sourceMappingURL=screen.d.ts.map