import { Reducer } from "@reduxjs/toolkit";
export interface ModuleSliceConfig<State = any> {
    name: string;
    reducer: Reducer<State>;
    persistToStorage: boolean;
    persistBlacklist?: string[];
}
//# sourceMappingURL=moduleSliceConfig.d.ts.map