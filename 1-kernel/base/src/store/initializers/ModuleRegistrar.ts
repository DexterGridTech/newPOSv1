import { combineEpics } from "redux-observable";
import { ActorSystem, registerScreenPart } from "../../core";
import { KernelModule, IModuleRegistrar } from "../types";

/**
 * 模块注册器实现
 * 职责: 负责注册所有模块的 Actors、Epics 和 ScreenParts
 */
export class ModuleRegistrar implements IModuleRegistrar {

    registerModules(modules: KernelModule[]): void {
        // 注册 Actors
        modules.forEach(module => {
            console.log(`[ModuleRegistrar] Registering module: ${module.name}`);
            module.actors.forEach(actor =>
                ActorSystem.getInstance().register(actor)
            );
        });
    }

    registerEpics(modules: KernelModule[], epicMiddleware: any): void {
        const epics = modules.flatMap(module => module.epics);
        if (epics.length > 0) {
            epicMiddleware.run(combineEpics(...epics));
        }
    }

    registerScreenParts(modules: KernelModule[]): void {
        modules.forEach(module => {
            if (module.screenParts) {
                module.screenParts.forEach(screenPart => {
                    registerScreenPart(screenPart);
                });
            }
        });
    }
}
