package com.impos2.adapter.interfaces

interface ILocalWebServer {
  fun start(config: LocalWebServerConfig = LocalWebServerConfig()): List<ServerAddress>
  fun stop()
  fun getStatus(): LocalWebServerInfo
  fun getStats(): ServerStats
}
