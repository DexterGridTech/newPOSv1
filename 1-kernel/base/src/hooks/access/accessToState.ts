import {instanceInfoSlice, RootState} from "../../features";
import {currentState} from "../../core";


export const getInstance = () => {
    return currentState<RootState>()[instanceInfoSlice.name].instance;
};