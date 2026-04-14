import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * state-runtime 把 Redux 保留为 kernel 核心真相源，同时把持久化和主副机同步策略从业务 slice 中抽出来。
 * slice 只声明 persist/sync 意图，具体按字段、按 record entry、普通/加密存储的落盘策略由这里统一执行。
 */
export * from './moduleName'
export {packageVersion}

export * from './application'
export * from './selectors'
export * from './hooks'
export * from './supports'
export * from './types'
