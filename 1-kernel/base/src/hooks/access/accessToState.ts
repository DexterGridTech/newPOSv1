import {instanceInfoSlice, RootState} from "../../features";
import {currentState} from "../../core";


export const selectInstance = () => {
    return currentState<RootState>()[instanceInfoSlice.name].instance;
};