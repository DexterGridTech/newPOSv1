export const topicTemplates = [
  {
    templateId: 'topic-terminal-runtime-config',
    category: 'terminal-runtime',
    key: 'terminal.runtime.config',
    name: '终端运行时配置',
    scopeType: 'TERMINAL',
    schema: { type: 'object', additionalProperties: true },
  },
  {
    templateId: 'topic-terminal-debug-flag',
    category: 'debug',
    key: 'terminal.debug.flag',
    name: '终端调试标记',
    scopeType: 'TERMINAL',
    schema: { type: 'object', additionalProperties: true },
  },
]

export const faultTemplates = [
  {
    templateId: 'fault-delay-config-publish',
    category: 'delivery-latency',
    name: '配置下发延迟',
    targetType: 'TDP_DELIVERY',
    matcher: { taskType: 'CONFIG_PUBLISH' },
    action: { type: 'DELAY', durationMs: 3000 },
  },
  {
    templateId: 'fault-timeout-upgrade',
    category: 'delivery-timeout',
    name: '升级任务超时',
    targetType: 'TDP_DELIVERY',
    matcher: { taskType: 'APP_UPGRADE' },
    action: { type: 'TIMEOUT', timeoutMs: 15000 },
  },
]
