import { AppModule } from "./types";
/**
 * 模块依赖解析器实现
 * 职责: 负责深度遍历、拉平和去重 KernelModule 依赖
 */
export declare class ModuleDependencyResolver {
    /**
     * 解析模块依赖,返回拉平且去重后的模块列表
     * @param modules 输入的模块列表
     * @returns 拉平且去重后的模块列表（严格依赖优先，A dependsOn B 则 B 一定在 A 前）
     */
    resolveModules(modules: AppModule[]): AppModule[];
    /**
     * 深度优先遍历单个模块及其依赖
     * @param module 当前模块
     * @param resolvedModules 已解析的模块列表
     * @param visitedModules 已完成访问的模块集合(用于去重)
     * @param visitingModules 正在访问中的模块集合(用于循环依赖检测)
     */
    private traverseModule;
}
//# sourceMappingURL=moduleDependencyResolver.d.ts.map