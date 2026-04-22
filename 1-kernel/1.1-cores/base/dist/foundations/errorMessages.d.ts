import { KeyValue } from "../types/foundations/keyValue";
import { ErrorCategory, ErrorSeverity } from "../types/shared/error";
export declare const registerModuleErrorMessages: (_moduleName: string, errorMessages: DefinedErrorMessage[]) => void;
export declare const getDefinedErrorMessageByKey: (key: string) => DefinedErrorMessage;
export declare class DefinedErrorMessage extends KeyValue<string> {
    readonly category: ErrorCategory;
    readonly severity: ErrorSeverity;
    constructor(category: ErrorCategory, severity: ErrorSeverity, name: string, key: string, defaultValue: string);
}
export { ErrorCategory, ErrorSeverity };
//# sourceMappingURL=errorMessages.d.ts.map