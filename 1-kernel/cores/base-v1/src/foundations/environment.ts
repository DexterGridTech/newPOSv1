import {Environment} from "../types/shared/environment";

let environment: Environment | null = null
export const getEnvironment = () => {
    return environment
};
export const setEnvironment = (env: Environment) => {
    environment = env;
};