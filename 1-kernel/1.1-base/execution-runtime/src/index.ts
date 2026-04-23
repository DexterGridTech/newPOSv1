import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * execution-runtime 是低层命令执行器，保留旧 core 中“命令生命周期可观测”的优点。
 * 它只处理 handler、middleware、journal 和错误归一化，不理解 Redux、不理解拓扑，也不承担业务路由。
 */
export * from './moduleName'
export {packageVersion}

export * from './application'
export * from './selectors'
export * from './hooks'
export * from './supports'
export * from './types'
