import { KernelModule, IModuleDependencyResolver } from "../types";

/**
 * 模块依赖解析器实现
 * 职责: 负责深度遍历、拉平和去重 KernelModule 依赖
 */
export class ModuleDependencyResolver implements IModuleDependencyResolver {
    /**
     * 解析模块依赖,返回拉平且去重后的模块列表
     * @param modules 输入的模块列表
     * @returns 拉平且去重后的模块列表
     */
    resolveModules(modules: KernelModule[]): KernelModule[] {
        const resolvedModules: KernelModule[] = [];
        const visitedModules = new Set<KernelModule>();

        // 深度优先遍历所有模块及其依赖
        modules.forEach(module => {
            this.traverseModule(module, resolvedModules, visitedModules);
        });

        return resolvedModules;
    }

    /**
     * 深度优先遍历单个模块及其依赖
     * @param module 当前模块
     * @param resolvedModules 已解析的模块列表
     * @param visitedModules 已访问的模块集合(用于去重)
     */
    private traverseModule(
        module: KernelModule,
        resolvedModules: KernelModule[],
        visitedModules: Set<KernelModule>
    ): void {
        // 如果已经访问过该模块(使用 === 判断),则跳过
        if (visitedModules.has(module)) {
            return;
        }

        // 标记为已访问
        visitedModules.add(module);

        // 先递归处理依赖(依赖优先)
        if (module.dependencies && module.dependencies.length > 0) {
            module.dependencies.forEach(dependency => {
                this.traverseModule(dependency, resolvedModules, visitedModules);
            });
        }

        // 再添加当前模块
        resolvedModules.push(module);
    }
}
