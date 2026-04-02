package com.impos2.adapter.interfaces

/**
 * 本地 WebServer 能力抽象。
 *
 * 上层只需要关心启停、状态和统计，不需要知道底层是否通过 Service、HTTP Server、WebSocket 等
 * 具体实现完成。
 */
interface ILocalWebServer {
  fun start(config: LocalWebServerConfig = LocalWebServerConfig()): List<ServerAddress>
  fun stop()
  fun getStatus(): LocalWebServerInfo
  fun getStats(): ServerStats
}
