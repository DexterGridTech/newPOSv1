import { useSelector } from "react-redux";
import { getFirstReadyScreenPartByContainerKey } from "../foundations/screens";
import { selectUiVariable } from "./useUiVariable";
const getCurrenReadyScreenPart = (containerKey, defaultValue, fromIndex) => getFirstReadyScreenPartByContainerKey(containerKey, fromIndex ?? -1) ?? defaultValue;
export const useChildScreenPart = (variable) => {
    return useSelector((state) => selectUiVariable(state, variable.key, getCurrenReadyScreenPart(variable.key, variable.defaultValue)));
};
