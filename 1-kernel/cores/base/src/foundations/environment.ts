import {Environment} from "../types/shared/environment";

let environment: Environment = {
    standalone: true,
    production: false
};
export const getEnvironment = () => {
    return environment
};
export const setEnvironment = (env: Environment) => {
    environment = env;
};