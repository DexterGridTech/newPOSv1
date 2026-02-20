import {PayloadAction} from "@reduxjs/toolkit";

export type ActionMeta = {
    commandId?: string;
    requestId?: string;
    sessionId?: string;
    addedAt: number;
};
export interface AppAction<T> extends PayloadAction<T>{
    meta?: ActionMeta;
}
