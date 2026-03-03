import {AppModule} from "./types";

/**
 * 模块依赖解析器实现
 * 职责: 负责深度遍历、拉平和去重 KernelModule 依赖
 */
export class ModuleDependencyResolver {
    /**
     * 解析模块依赖,返回拉平且去重后的模块列表
     * @param modules 输入的模块列表
     * @returns 拉平且去重后的模块列表，按 priority 升序排序（priority 越小越靠前，未定义的排最后）
     */
    resolveModules(modules: AppModule[]): AppModule[] {
        const resolvedModules: AppModule[] = [];
        const visitedModules = new Set<AppModule>();
        const visitingModules = new Set<AppModule>();

        // 深度优先遍历所有模块及其依赖
        modules.forEach(module => {
            this.traverseModule(module, resolvedModules, visitedModules, visitingModules);
        });

        // 根据 priority 排序，priority 越小越靠前，未定义 priority 的排在最后
        return resolvedModules.sort((a, b) => {
            const priorityA = a.preSetupPriority;
            const priorityB = b.preSetupPriority;

            // 都未定义 priority，保持原序
            if (priorityA === undefined && priorityB === undefined) return 0;
            // 如果 a 未定义 priority，排在后面
            if (priorityA === undefined) return 1;
            // 如果 b 未定义 priority，排在后面
            if (priorityB === undefined) return -1;
            // 都定义了，按升序排序
            return priorityA - priorityB;
        });
    }

    /**
     * 深度优先遍历单个模块及其依赖
     * @param module 当前模块
     * @param resolvedModules 已解析的模块列表
     * @param visitedModules 已完成访问的模块集合(用于去重)
     * @param visitingModules 正在访问中的模块集合(用于循环依赖检测)
     */
    private traverseModule(
        module: AppModule,
        resolvedModules: AppModule[],
        visitedModules: Set<AppModule>,
        visitingModules: Set<AppModule>
    ): void {
        // 如果已经完成访问,则跳过
        if (visitedModules.has(module)) {
            return;
        }

        // 如果正在访问中，说明存在循环依赖
        if (visitingModules.has(module)) {
            throw new Error(`Circular dependency detected: module "${module.name}" is part of a dependency cycle`);
        }

        // 标记为正在访问
        visitingModules.add(module);

        // 先递归处理依赖(依赖优先)
        if (module.dependencies && module.dependencies.length > 0) {
            module.dependencies.forEach(dependency => {
                this.traverseModule(dependency, resolvedModules, visitedModules, visitingModules);
            });
        }

        // 访问完成，从 visiting 移到 visited
        visitingModules.delete(module);
        visitedModules.add(module);

        // 再添加当前模块
        resolvedModules.push(module);
    }
}
