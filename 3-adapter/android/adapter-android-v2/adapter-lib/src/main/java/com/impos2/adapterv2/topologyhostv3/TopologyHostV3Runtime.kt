package com.impos2.adapterv2.topologyhostv3

import org.json.JSONObject

internal class TopologyHostV3Runtime {
  private val lock = Any()
  private val faultRules = linkedMapOf<String, TopologyHostV3FaultRule>()
  private val peersByRole = linkedMapOf<String, TopologyHostV3PeerRecord>()
  private var sessionId: String? = null
  private var state: String = "idle"
  private var hostRuntime: TopologyHostV3RuntimeInfo? = null

  fun markRunning() {
    synchronized(lock) {
      state = "running"
    }
  }

  fun setHostRuntime(runtime: TopologyHostV3RuntimeInfo) {
    synchronized(lock) {
      hostRuntime = runtime
    }
  }

  fun markClosed() {
    synchronized(lock) {
      state = "closed"
      peersByRole.clear()
      sessionId = null
    }
  }

  fun processHello(connectionId: String, hello: TopologyHostV3Hello): TopologyHostV3HelloAck {
    synchronized(lock) {
      val role = hello.runtime.instanceMode
      val occupied = peersByRole[role]
      if (occupied != null && occupied.runtime.nodeId != hello.runtime.nodeId) {
        return TopologyHostV3HelloAck(
          helloId = hello.helloId,
          accepted = false,
          rejectionCode = "ROLE_OCCUPIED",
          rejectionMessage = "$role is already connected",
          hostTime = System.currentTimeMillis(),
        )
      }

      peersByRole[role] = TopologyHostV3PeerRecord(
        runtime = hello.runtime,
        connectionId = connectionId,
      )
      if (sessionId == null) {
        sessionId = TopologyHostV3Ids.createSessionId()
      }

      val peerRole = if (role == "MASTER") "SLAVE" else "MASTER"
      return TopologyHostV3HelloAck(
        helloId = hello.helloId,
        accepted = true,
        sessionId = sessionId,
        peerRuntime = peersByRole[peerRole]?.runtime,
        hostTime = System.currentTimeMillis(),
      )
    }
  }

  fun getPeerUpdate(forRole: String): TopologyHostV3RuntimeInfo? {
    synchronized(lock) {
      val peerRole = if (forRole == "MASTER") "SLAVE" else "MASTER"
      return peersByRole[peerRole]?.runtime
    }
  }

  fun detachConnection(connectionId: String) {
    synchronized(lock) {
      val matched = peersByRole.entries.firstOrNull { it.value.connectionId == connectionId }?.key
      if (matched != null) {
        peersByRole.remove(matched)
      }
      if (peersByRole.isEmpty()) {
        sessionId = null
      }
    }
  }

  fun resolveRelayTarget(message: JSONObject): String? {
    synchronized(lock) {
      return message.optStringOrNull("targetNodeId")
    }
  }

  fun getConnectionIdByNodeId(nodeId: String): String? {
    synchronized(lock) {
      return peersByRole.values.firstOrNull { it.runtime.nodeId == nodeId }?.connectionId
    }
  }

  fun replaceFaultRules(rules: List<TopologyHostV3FaultRule>): Int {
    synchronized(lock) {
      faultRules.clear()
      rules.forEach { faultRules[it.ruleId] = it }
      return faultRules.size
    }
  }

  fun shouldDrop(channel: String): Boolean {
    synchronized(lock) {
      return faultRules.values.any { it.kind == "relay-drop" && (it.channel == null || it.channel == channel) }
    }
  }

  fun shouldDisconnect(channel: String): Boolean {
    synchronized(lock) {
      return faultRules.values.any { it.kind == "relay-disconnect-target" && (it.channel == null || it.channel == channel) }
    }
  }

  fun resolveDelayMs(channel: String): Long {
    synchronized(lock) {
      return faultRules.values
        .filter { it.kind == "relay-delay" && (it.channel == null || it.channel == channel) }
        .maxOfOrNull { it.delayMs ?: 0L } ?: 0L
    }
  }

  fun getStats(): TopologyHostV3Stats {
    synchronized(lock) {
      return TopologyHostV3Stats(
        sessionCount = if (sessionId == null) 0 else 1,
        activeFaultRuleCount = faultRules.size,
      )
    }
  }

  fun getDiagnosticsSnapshot(): TopologyHostV3DiagnosticsSnapshot {
    synchronized(lock) {
      return TopologyHostV3DiagnosticsSnapshot(
        moduleName = TOPOLOGY_HOST_V3_MODULE_NAME,
        state = state,
        sessionId = sessionId,
        hostRuntime = hostRuntime,
        peers = peersByRole.map { (role, record) ->
          TopologyHostV3PeerSnapshot(
            role = role,
            nodeId = record.runtime.nodeId,
            deviceId = record.runtime.deviceId,
          )
        },
        faultRules = faultRules.values.toList(),
      )
    }
  }
}
