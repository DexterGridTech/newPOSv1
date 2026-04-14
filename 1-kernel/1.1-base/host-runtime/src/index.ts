import {packageVersion} from './generated/packageVersion'

/**
 * 设计意图：
 * host-runtime 是双机拓扑 host 的纯内核控制面，负责 ticket、session、relay、resume 与故障注入。
 * 它不启动 HTTP/WS server；server 只应是薄适配层，方便同一套 host 能力被 mock-server 或终端内置宿主复用。
 */
export * from './moduleName'
export {packageVersion}

export * from './application'
export * from './selectors'
export * from './hooks'
export * from './supports'
export * from './types'
