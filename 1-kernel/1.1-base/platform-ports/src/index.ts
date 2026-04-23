import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * platform-ports 定义内核访问外部世界的端口，包括日志、时间、存储等宿主能力。
 * kernel 包不能直接依赖 React、Android、Node、Web 或 Electron 细节；这些差异都应通过 ports 注入。
 */
export * from './moduleName'

export {packageVersion}

export * from './application'
export * from './selectors'
export * from './hooks'
export * from './supports'
export * from './types'
