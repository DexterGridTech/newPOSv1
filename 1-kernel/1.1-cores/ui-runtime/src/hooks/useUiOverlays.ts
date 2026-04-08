import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {selectCurrentOverlays} from "../selectors";

export const useUiOverlays = () => {
    return useSelector((state: RootState) => selectCurrentOverlays(state))
}
