package com.impos2.mixcretailassemblyrn84.startup

import android.content.Context
import com.impos2.adapterv2.device.DeviceManager
import com.impos2.adapterv2.topologyhost.TopologyHostAddressInfo
import com.impos2.adapterv2.topologyhost.TopologyHostConfig
import com.impos2.adapterv2.topologyhost.TopologyHostDefaults
import com.impos2.adapterv2.topologyhost.TopologyHostManager
data class PreparedTopologyLaunch(
  val masterNodeId: String,
  val ticketToken: String,
  val wsUrl: String,
  val httpBaseUrl: String,
)

/**
 * 设计意图：
 * 由原生宿主统一准备主副屏共享的 topology launch context，避免：
 * - 主副屏各自猜 wsUrl / ticket / nodeId；
 * - assembly 把 topology host 业务逻辑散落在多个 Activity / JS 层入口。
 */
object TopologyLaunchCoordinator {
  private const val PREFS_NAME = "mixc_retail_assembly_topology_launch"
  private const val KEY_MASTER_NODE_ID = "masterNodeId"
  private const val KEY_TICKET_TOKEN = "ticketToken"
  private const val KEY_WS_URL = "wsUrl"
  private const val KEY_HTTP_BASE_URL = "httpBaseUrl"
  private const val KEY_PREPARED_AT = "preparedAt"

  @Synchronized
  fun prepare(context: Context, displayCount: Int): PreparedTopologyLaunch? {
    if (displayCount <= 1) {
      clear(context)
      return null
    }

    val manager = TopologyHostManager.getInstance(context.applicationContext)
    val address = ensureHost(manager)
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val cachedMasterNodeId = prefs.getString(KEY_MASTER_NODE_ID, null)
    val cachedWsUrl = prefs.getString(KEY_WS_URL, null)
    val cachedHttpBaseUrl = prefs.getString(KEY_HTTP_BASE_URL, null)

    val masterNodeId = cachedMasterNodeId
      ?: "master:${DeviceManager.getInstance(context.applicationContext).getDeviceInfo().id}"
    val ticketToken = manager.issueTicket(
      masterNodeId = masterNodeId,
      transportUrls = listOf(address.wsUrl),
      expiresInMs = TopologyHostDefaults.DEFAULT_TICKET_EXPIRES_IN_MS,
    ).token ?: throw IllegalStateException("Topology host did not return ticket token")

    prefs.edit()
      .putString(KEY_MASTER_NODE_ID, masterNodeId)
      .putString(KEY_TICKET_TOKEN, ticketToken)
      .putString(KEY_WS_URL, address.wsUrl)
      .putString(KEY_HTTP_BASE_URL, address.httpBaseUrl)
      .putLong(KEY_PREPARED_AT, System.currentTimeMillis())
      .apply()

    return PreparedTopologyLaunch(
      masterNodeId = masterNodeId,
      ticketToken = ticketToken,
      wsUrl = address.wsUrl,
      httpBaseUrl = address.httpBaseUrl,
    )
  }

  fun load(context: Context): PreparedTopologyLaunch? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val masterNodeId = prefs.getString(KEY_MASTER_NODE_ID, null)
    val ticketToken = prefs.getString(KEY_TICKET_TOKEN, null)
    val wsUrl = prefs.getString(KEY_WS_URL, null)
    val httpBaseUrl = prefs.getString(KEY_HTTP_BASE_URL, null)
    if (
      masterNodeId.isNullOrBlank() ||
      ticketToken.isNullOrBlank() ||
      wsUrl.isNullOrBlank() ||
      httpBaseUrl.isNullOrBlank()
    ) {
      return null
    }
    return PreparedTopologyLaunch(
      masterNodeId = masterNodeId,
      ticketToken = ticketToken,
      wsUrl = wsUrl,
      httpBaseUrl = httpBaseUrl,
    )
  }

  fun clear(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
  }

  private fun ensureHost(manager: TopologyHostManager): TopologyHostAddressInfo {
    val status = manager.getStatus()
    return if (status.addressInfo != null && status.state.name == "RUNNING") {
      status.addressInfo
        ?: throw IllegalStateException("Topology host reported RUNNING without address info")
    } else {
      manager.start(
        TopologyHostConfig(
          port = TopologyHostDefaults.DEFAULT_PORT,
          basePath = TopologyHostDefaults.DEFAULT_BASE_PATH,
          heartbeatIntervalMs = TopologyHostDefaults.DEFAULT_HEARTBEAT_INTERVAL_MS,
          heartbeatTimeoutMs = TopologyHostDefaults.DEFAULT_HEARTBEAT_TIMEOUT_MS,
          defaultTicketExpiresInMs = TopologyHostDefaults.DEFAULT_TICKET_EXPIRES_IN_MS,
        ),
      )
    }
  }

}
