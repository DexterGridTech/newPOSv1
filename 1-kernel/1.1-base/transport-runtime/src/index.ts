import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * transport-runtime 提供 HTTP 与 WS 的通用传输基础设施，包括地址选择、失败切换、有效地址保持和 socket 生命周期控制。
 * 它只表达 transport 语义，不表达业务完成语义；业务包通过 endpoint/profile 定义和 service binder 组合自己的协议。
 */
export * from './moduleName'
export {packageVersion}

export * from './application'
export * from './features/commands'
export * from './features/slices'
export * from './supports'
export * from './selectors'
export * from './types'
export * from './foundations'
