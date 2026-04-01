package com.impos2.adapter.dev.ui

enum class TestModule(
  val title: String,
  val description: String,
  val capabilityTags: List<String>,
  val userRoleHint: String,
  val quickHint: String,
) {
  DEVICE(
    "Device",
    "设备信息、系统状态、电源状态监听与硬件资源概览",
    listOf("Info", "Status", "Power"),
    "现场诊断",
    "优先用于确认设备识别、系统状态采集与电源事件链路是否正常。"
  ),
  CONNECTOR(
    "Connector",
    "Camera、system picker、HID、passive 连接能力",
    listOf("Intent", "Stream", "Camera"),
    "交互验证",
    "适合验证扫码、外设输入、被动广播与系统选择器链路。"
  ),
  LOCAL_WEBSERVER(
    "LocalWebServer",
    "本地服务启动、状态、地址、路由验证",
    listOf("Server", "Health", "Stats"),
    "网络验证",
    "用于确认本地服务能否启动、响应健康检查并输出运行统计。"
  ),
  STATE_STORAGE(
    "StateStorage",
    "原生存储读写、存在性、清理验证",
    listOf("KV", "Persist", "Keys"),
    "数据验证",
    "用于确认 Key-Value 写入、读取、键集合和清空逻辑是否一致。"
  ),
  LOGGER(
    "Logger",
    "日志写入、读取、目录和清理能力",
    listOf("Write", "Read", "Files"),
    "日志诊断",
    "适合验证日志落盘、文件读取与目录管理是否满足排查需求。"
  ),
  SCRIPT_ENGINE(
    "ScriptEngine",
    "脚本执行、参数传递、错误与统计",
    listOf("Execute", "Error", "Stats"),
    "执行验证",
    "用于确认脚本执行结果、异常链路和统计指标是否正确。"
  ),
  APP_CONTROL(
    "AppControl",
    "全屏、锁定、loading、退出控制",
    listOf("Fullscreen", "Kiosk", "Lifecycle"),
    "控制验证",
    "适合现场确认全屏、锁定模式与 loading 控制动作是否生效。"
  ),
}
