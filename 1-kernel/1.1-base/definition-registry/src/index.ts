import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * definition-registry 是错误定义和参数定义的静态注册与解析层。
 * 它负责唯一的 decode/validate/fallback 规则，不持有 runtime state；runtime-shell 只把当前 catalog 快照交给这里解析。
 */
export * from './moduleName'

export {packageVersion}

export * from './application'
export * from './selectors'
export * from './hooks'
export * from './supports'
export * from './types'
