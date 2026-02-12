import {Environment, ModuleSliceConfig} from "../types";
import {Epic} from "redux-observable";
import {IActor} from "../foundations";


export interface AppModule {
    name: string
    version: string
    dependencies: AppModule[]
    setup?: (en: Environment, allModules: AppModule[]) => Promise<void>
    //todo
    slices: { [key: string]: ModuleSliceConfig }
    epics: { [key: string]: Epic }
    actors: { [key: string]: IActor }
    commands: any
    apis: any
    errors: any
    parameters: any
}
export interface IModuleDependencyResolver {
    resolveModules(modules: AppModule[]): AppModule[];
}