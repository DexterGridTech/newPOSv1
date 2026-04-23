import {packageVersion} from './generated/packageVersion'
import {protocolVersion} from './generated/protocolVersion'

/**
 * 设计意图：
 * contracts 只承载跨包共享语言，包括 ID、时间、错误、参数、请求、拓扑、状态同步等协议对象。
 * 这里不放运行时状态、不访问平台能力，也不依赖任何具体 runtime；这样上层包可以稳定依赖这些类型和基础工厂。
 */
export * from './moduleName'

export {packageVersion, protocolVersion}

export * from './application'
export * from './selectors'
export * from './hooks'
export * from './supports'
export * from './types'
export * from './protocol'
