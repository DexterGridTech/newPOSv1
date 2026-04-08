import {useSelector} from 'react-redux';
import {RootState, shortId} from "@impos2/kernel-core-base";
import {kernelCoreUiRuntimeCommands} from "../features/commands";
import {selectUiVariable} from "../selectors";

export interface UiVariable<T> {
    key: string,
    defaultValue: T
}

export function useEditableUiVariable<T>(variable: UiVariable<T>): {
    value: T;
    setValue: (value: T) => void;
} {
    const stateValue = useSelector((state: RootState) =>
        selectUiVariable<T>(state, variable.key, variable.defaultValue)
    )

    const setValue = (value: T) => {
        kernelCoreUiRuntimeCommands.setUiVariables({[variable.key]: value}).execute(shortId())
    }

    return {
        value: stateValue,
        setValue,
    }
}
