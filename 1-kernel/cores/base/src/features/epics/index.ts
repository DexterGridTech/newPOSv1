import {Epic} from "redux-observable";
import {PayloadAction} from "@reduxjs/toolkit";
import {RootState} from "../../types";

export const kernelCoreBaseEpics:Record<string, Epic<PayloadAction, PayloadAction, RootState>> = {
}