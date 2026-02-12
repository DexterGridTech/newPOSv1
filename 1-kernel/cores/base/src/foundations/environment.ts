import {Environment} from "../types";

let environment: Environment | null = null;
export const getEnvironment = () => {
    if (!environment)
        throw new Error('Environment not initialized')
    return environment
};
export const setEnvironment = (env: Environment) => {
    environment = env;
};