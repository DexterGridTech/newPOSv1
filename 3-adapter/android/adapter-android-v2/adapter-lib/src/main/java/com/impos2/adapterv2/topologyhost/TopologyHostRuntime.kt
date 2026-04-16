package com.impos2.adapterv2.topologyhost

import com.impos2.adapterv2.logger.LogManager
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Kotlin 版 topology host 真相源。
 *
 * 它直接承接 `1-kernel/1.1-base/host-runtime` 的核心职责：
 * - 发 ticket
 * - 维护 session / node / connection
 * - 管理 relay 队列
 * - 管理 resume 语义
 * - 注入 fault rule
 *
 * HTTP / WS / Android Service 只负责承载，不再重复协议状态判断。
 */
internal class TopologyHostRuntime(
  private val hostRuntimeInfo: TopologyHostRuntimeInfo,
  private val config: TopologyHostConfig,
  private val logger: LogManager,
  private val requiredCapabilities: List<String> = emptyList(),
  private val maxObservationEvents: Int = 200,
) {
  private val lock = Any()
  private val tickets = LinkedHashMap<String, TopologyHostTicketRecord>()
  private val sessions = LinkedHashMap<String, TopologyHostSessionRecord>()
  private val tokenToSessionId = LinkedHashMap<String, String>()
  private val connections = LinkedHashMap<String, TopologyHostConnectionRecord>()
  private val relayQueueByConnection = LinkedHashMap<String, MutableList<TopologyHostRelayDelivery>>()
  private val offlineRelayQueueByTarget = LinkedHashMap<String, MutableList<TopologyHostRelayDelivery>>()
  private val relayPendingBySession = LinkedHashMap<String, Int>()
  private val relaySequenceBySessionChannel = LinkedHashMap<String, Int>()
  private val faultRules = LinkedHashMap<String, TopologyHostFaultRule>()
  private val recentEvents = ArrayDeque<TopologyHostObservationEvent>()
  private val relayCounters = intArrayOf(0, 0, 0, 0, 0)
  private val connectionContexts = ConcurrentHashMap<String, TopologyHostConnectionContext>()

  fun getHostRuntimeInfo(): TopologyHostRuntimeInfo = hostRuntimeInfo

  fun issueTicket(masterNodeId: String, transportUrls: List<String>, expiresInMs: Long): TopologyHostTicketRecord {
    val issuedAt = System.currentTimeMillis()
    val ticket = TopologyHostPairingTicket(
      token = "ticket_${TopologyHostIds.createEnvelopeId().removePrefix("henv_")}",
      masterNodeId = masterNodeId,
      transportUrls = transportUrls,
      issuedAt = issuedAt,
      expiresAt = issuedAt + expiresInMs,
      hostRuntime = hostRuntimeInfo,
    )
    val record = TopologyHostTicketRecord(
      ticket = ticket,
      updatedAt = issuedAt,
    )
    synchronized(lock) {
      tickets[ticket.token] = record
    }
    recordEvent(
      level = "info",
      category = "host.ticket",
      event = "issued",
      nodeId = masterNodeId,
      data = JSONObject()
        .put("token", ticket.token)
        .put("expiresAt", ticket.expiresAt)
        .put("transportUrls", transportUrls.toJsonStringArray()),
    )
    return cloneTicketRecord(record)
  }

  fun replaceFaultRules(rules: List<TopologyHostFaultRule>) {
    synchronized(lock) {
      faultRules.clear()
      rules.forEach { faultRules[it.ruleId] = normalizeFaultRule(it) }
    }
  }

  fun listFaultRules(): List<TopologyHostFaultRule> {
    return synchronized(lock) {
      faultRules.values.map { it.copy() }
    }
  }

  fun getSession(sessionId: String): TopologyHostSessionRecord? {
    return synchronized(lock) {
      sessions[sessionId]?.let(::cloneSessionRecord)
    }
  }

  fun recordHeartbeat(connectionId: String, occurredAt: Long = System.currentTimeMillis()) {
    synchronized(lock) {
      val connection = connections[connectionId] ?: return
      val session = sessions[connection.sessionId] ?: return
      val node = session.nodes[connection.nodeId] ?: return
      connection.lastHeartbeatAt = occurredAt
      node.lastHeartbeatAt = occurredAt
      session.updatedAt = occurredAt
    }
    recordEvent(
      level = "debug",
      category = "host.connection",
      event = "heartbeat",
      connectionId = connectionId,
    )
  }

  fun expireIdleConnections(now: Long = System.currentTimeMillis()): List<TopologyHostConnectionRecord> {
    val expired = synchronized(lock) {
      connections.values
        .filter { now - it.lastHeartbeatAt > config.heartbeatTimeoutMs }
        .map { it.copy() }
    }
    expired.forEach { connection ->
      detachConnection(connection.connectionId, "heartbeat-timeout", now)
    }
    return expired
  }

  fun processHello(connectionId: String, hello: TopologyHostNodeHello, receivedAt: Long = System.currentTimeMillis()): TopologyHostHelloResult {
    val result = synchronized(lock) {
      val ticketRecord = tickets[hello.ticketToken]
        ?: return@synchronized buildRejectedHello(
          hello = hello,
          hostTime = receivedAt,
          rejectionCode = "TOKEN_INVALID",
          rejectionMessage = "pairing ticket not found",
          faultRuleIds = emptyList(),
        )

      if (ticketRecord.ticket.expiresAt < receivedAt) {
        return@synchronized buildRejectedHello(
          hello = hello,
          hostTime = receivedAt,
          rejectionCode = "TOKEN_EXPIRED",
          rejectionMessage = "pairing ticket expired",
          faultRuleIds = emptyList(),
        )
      }

      val helloFault = matchHelloFault(
        sessionId = ticketRecord.sessionId,
        sourceNodeId = hello.runtime.nodeId,
        targetRole = hello.runtime.role,
      )

      if (helloFault.rejectionCode != null) {
        return@synchronized buildRejectedHello(
          hello = hello,
          hostTime = receivedAt,
          rejectionCode = helloFault.rejectionCode,
          rejectionMessage = helloFault.rejectionMessage ?: "hello rejected by fault rule",
          faultRuleIds = helloFault.ruleIds,
        )
      }

      if (hello.runtime.role == "master" && hello.runtime.nodeId != ticketRecord.ticket.masterNodeId) {
        return@synchronized buildRejectedHello(
          hello = hello,
          hostTime = receivedAt,
          rejectionCode = "ROLE_CONFLICT",
          rejectionMessage = "master node does not match ticket owner",
          faultRuleIds = helloFault.ruleIds,
        )
      }

      val occupied = ticketRecord.occupiedRoles[hello.runtime.role]
      if (occupied != null && occupied.nodeId != hello.runtime.nodeId) {
        return@synchronized buildRejectedHello(
          hello = hello,
          hostTime = receivedAt,
          rejectionCode = "PAIR_OCCUPIED",
          rejectionMessage = "${hello.runtime.role} already occupied",
          faultRuleIds = helloFault.ruleIds,
        )
      }

      val compatibility = evaluateCompatibility(hello.runtime)
      if (compatibility.level == "rejected") {
        val reason = compatibility.reasons.firstOrNull() ?: "protocol incompatible"
        return@synchronized buildRejectedHello(
          hello = hello,
          hostTime = receivedAt,
          rejectionCode = if (reason.contains("capability")) "CAPABILITY_MISSING" else "PROTOCOL_INCOMPATIBLE",
          rejectionMessage = reason,
          faultRuleIds = helloFault.ruleIds,
        )
      }

      val session = ensureSession(ticketRecord, hello.runtime, compatibility, receivedAt)
      bindTicketOccupancy(ticketRecord, hello.runtime, session.sessionId, connected = false, updatedAt = receivedAt)
      val peerRuntime = session.nodes.values.firstOrNull { it.nodeId != hello.runtime.nodeId }?.runtime
      val attachResult = attachConnectionLocked(session.sessionId, hello.runtime.nodeId, connectionId, receivedAt)
      bindTicketOccupancy(ticketRecord, hello.runtime, session.sessionId, connected = true, updatedAt = receivedAt)

      connectionContexts[connectionId] = TopologyHostConnectionContext(
        connectionId = connectionId,
        sessionId = session.sessionId,
        nodeId = hello.runtime.nodeId,
      )

      recordEvent(
        level = if (compatibility.level == "degraded") "warn" else "info",
        category = "host.hello",
        event = "accepted",
        sessionId = session.sessionId,
        nodeId = hello.runtime.nodeId,
        connectionId = attachResult.connectionId,
        data = JSONObject()
          .put("compatibilityLevel", compatibility.level)
          .put("reasons", compatibility.reasons.toJsonStringArray())
          .put("faultRuleIds", helloFault.ruleIds.toJsonStringArray()),
      )

      TopologyHostHelloResult(
        ack = TopologyHostNodeHelloAck(
          helloId = hello.helloId,
          accepted = true,
          sessionId = session.sessionId,
          peerRuntime = peerRuntime,
          compatibility = compatibility,
          hostTime = receivedAt,
        ),
        delayMs = helloFault.delayMs,
        faultRuleIds = helloFault.ruleIds,
      )
    }

    return result
  }

  fun handleResumeBegin(sessionId: String, nodeId: String, timestamp: Long): List<TopologyHostRelayDelivery> {
    synchronized(lock) {
      val session = sessions[sessionId] ?: return emptyList()
      val pendingIds = LinkedHashSet(session.resume.pendingNodeIds)
      pendingIds += nodeId
      session.resume.phase = "resyncing"
      session.resume.pendingNodeIds.clear()
      session.resume.pendingNodeIds.addAll(pendingIds)
      session.resume.startedAt = timestamp
      session.updatedAt = timestamp
      session.status = resolveSessionStatus(session)

      session.nodes.values
        .filter { it.nodeId != nodeId && it.connected }
        .forEach { peerNode ->
          val envelope = JSONObject()
            .put("envelopeId", TopologyHostIds.createEnvelopeId())
            .put("sessionId", sessionId)
            .put("sourceNodeId", nodeId)
            .put("targetNodeId", peerNode.nodeId)
            .put("timestamp", timestamp)
          enqueueRelayLocked(
            sessionId = sessionId,
            channel = TopologyHostRelayChannel.RESUME,
            sourceNodeId = nodeId,
            targetNodeId = peerNode.nodeId,
            targetConnectionId = peerNode.connectionId,
            availableAt = timestamp,
            envelope = envelope,
          )
        }
    }
    return flushAllConnectionOutboxes()
  }

  fun handleResumeComplete(connectionId: String, sessionId: String, nodeId: String, timestamp: Long): List<TopologyHostRelayDelivery> {
    synchronized(lock) {
      val session = sessions[sessionId] ?: return emptyList()
      session.resume.pendingNodeIds.removeAll { it == nodeId }
      session.resume.completedAt = timestamp
      session.resume.phase = if (session.resume.pendingNodeIds.isEmpty()) "idle" else "resyncing"
      session.updatedAt = timestamp
      session.status = resolveSessionStatus(session)
    }
    return drainConnectionOutbox(connectionId, timestamp)
  }

  fun relayEnvelope(connectionId: String, envelope: JSONObject, relayedAt: Long = System.currentTimeMillis()): TopologyHostRelayResult {
    return synchronized(lock) {
      val context = connectionContexts[connectionId]
        ?: throw IllegalStateException("connection context missing: $connectionId")
      val sessionId = context.sessionId
        ?: throw IllegalStateException("session missing for connection: $connectionId")
      val sourceNodeId = context.nodeId
        ?: throw IllegalStateException("node missing for connection: $connectionId")
      val session = sessions[sessionId]
        ?: throw IllegalStateException("session not found: $sessionId")

      val channel = resolveRelayChannel(envelope)
      val targetNodeId = resolveRelayTargetNodeId(envelope)
      val targetNode = session.nodes[targetNodeId]
        ?: throw IllegalStateException("target node not found: $targetNodeId")
      val fault = matchRelayFault(
        sessionId = sessionId,
        sourceNodeId = sourceNodeId,
        targetNodeId = targetNodeId,
        targetRole = targetNode.role,
        channel = channel,
      )
      val disconnectedConnectionIds = mutableListOf<String>()

      if (fault.disconnectTarget && targetNode.connectionId != null) {
        relayCounters[4] += 1
        disconnectedConnectionIds += targetNode.connectionId!!
        detachConnection(targetNode.connectionId!!, "fault:relay-disconnect-target", relayedAt)
      }

      if (fault.dropCurrentRelay) {
        relayCounters[2] += 1
        recordEvent(
          level = "warn",
          category = "host.relay",
          event = "dropped",
          sessionId = sessionId,
          nodeId = targetNodeId,
          data = JSONObject()
            .put("channel", channel.name.lowercase())
            .put("faultRuleIds", fault.ruleIds.toJsonStringArray()),
        )
        return@synchronized TopologyHostRelayResult(
          channel = channel,
          deliveries = emptyList(),
          queuedForOfflinePeer = false,
          dropped = true,
          disconnectedConnectionIds = disconnectedConnectionIds,
          effect = fault,
        )
      }

      val delivery = enqueueRelayLocked(
        sessionId = sessionId,
        channel = channel,
        sourceNodeId = sourceNodeId,
        targetNodeId = targetNodeId,
        targetConnectionId = targetNode.connectionId,
        availableAt = relayedAt + (fault.delayMs ?: 0L),
        envelope = envelope,
      )
      syncPendingCountLocked(sessionId, relayedAt)
      recordEvent(
        level = if (targetNode.connectionId == null) "warn" else "info",
        category = "host.relay",
        event = if (targetNode.connectionId == null) "peer-offline" else "enqueued",
        sessionId = sessionId,
        nodeId = targetNodeId,
        connectionId = targetNode.connectionId,
        data = JSONObject()
          .put("channel", channel.name.lowercase())
          .put("sequence", delivery.sequence)
          .put("delayMs", fault.delayMs)
          .put("faultRuleIds", fault.ruleIds.toJsonStringArray()),
      )

      TopologyHostRelayResult(
        channel = channel,
        deliveries = listOf(delivery),
        queuedForOfflinePeer = targetNode.connectionId == null,
        dropped = false,
        disconnectedConnectionIds = disconnectedConnectionIds,
        effect = fault,
      )
    }
  }

  fun drainConnectionOutbox(connectionId: String, now: Long = System.currentTimeMillis()): List<TopologyHostRelayDelivery> {
    return synchronized(lock) {
      val connection = connections[connectionId]
      val session = connection?.let { sessions[it.sessionId] }
      val onlyResume = session?.resume?.phase != null && session.resume.phase != "idle"
      val deliveries = drainConnectionQueueLocked(connectionId, now, onlyResume)
      deliveries.forEach { delivery ->
        syncPendingCountLocked(delivery.sessionId, now)
        recordEvent(
          level = "info",
          category = "host.relay",
          event = if (onlyResume) "resume-flushed" else "flushed",
          sessionId = delivery.sessionId,
          nodeId = delivery.targetNodeId,
          connectionId = connectionId,
          data = JSONObject()
            .put("channel", delivery.channel.name.lowercase())
            .put("sequence", delivery.sequence),
        )
      }
      deliveries
    }
  }

  fun flushAllConnectionOutboxes(now: Long = System.currentTimeMillis()): List<TopologyHostRelayDelivery> {
    val connectionIds = synchronized(lock) {
      connections.keys.toList()
    }
    return connectionIds.flatMap { drainConnectionOutbox(it, now) }
  }

  fun getStats(): TopologyHostStats {
    return synchronized(lock) {
      TopologyHostStats(
        ticketCount = tickets.size,
        sessionCount = sessions.size,
        relayCounters = TopologyHostRelayCounters(
          enqueued = relayCounters[0],
          delivered = relayCounters[1],
          dropped = relayCounters[2],
          flushed = relayCounters[3],
          disconnected = relayCounters[4],
        ),
        activeFaultRuleCount = faultRules.size,
        activeConnectionCount = sessions.values.sumOf { session ->
          session.nodes.values.count { it.connected }
        },
      )
    }
  }

  fun getDiagnosticsSnapshot(): TopologyHostDiagnosticsSnapshot {
    return synchronized(lock) {
      TopologyHostDiagnosticsSnapshot(
        hostRuntime = hostRuntimeInfo,
        tickets = tickets.values.map(::cloneTicketRecord),
        sessions = sessions.values.map(::cloneSessionRecord),
        relayCounters = TopologyHostRelayCounters(
          enqueued = relayCounters[0],
          delivered = relayCounters[1],
          dropped = relayCounters[2],
          flushed = relayCounters[3],
          disconnected = relayCounters[4],
        ),
        activeFaultRules = faultRules.values.map { it.copy() },
        recentEvents = recentEvents.toList(),
      )
    }
  }

  fun detachConnection(connectionId: String, reason: String, disconnectedAt: Long = System.currentTimeMillis()): TopologyHostConnectionRecord? {
    return synchronized(lock) {
      val connection = connections.remove(connectionId) ?: return@synchronized null
      val session = sessions[connection.sessionId] ?: return@synchronized connection
      val node = session.nodes[connection.nodeId] ?: return@synchronized connection
      node.connected = false
      node.connectionId = null
      node.disconnectedAt = disconnectedAt
      val pending = LinkedHashSet(session.resume.pendingNodeIds)
      pending += connection.nodeId
      session.resume.phase = "required"
      session.resume.pendingNodeIds.clear()
      session.resume.pendingNodeIds.addAll(pending)
      session.resume.requiredAt = disconnectedAt
      session.resume.reason = reason
      session.updatedAt = disconnectedAt
      session.status = resolveSessionStatus(session)
      connectionContexts.remove(connectionId)

      recordEvent(
        level = "warn",
        category = "host.connection",
        event = "detached",
        sessionId = connection.sessionId,
        nodeId = connection.nodeId,
        connectionId = connectionId,
        message = reason,
      )
      connection.copy()
    }
  }

  private fun attachConnectionLocked(sessionId: String, nodeId: String, connectionId: String, connectedAt: Long): TopologyHostConnectionRecord {
    val session = sessions[sessionId] ?: throw IllegalStateException("session not found: $sessionId")
    val node = session.nodes[nodeId] ?: throw IllegalStateException("node not found: $nodeId")
    node.connectionId?.let { previousConnectionId ->
      connections.remove(previousConnectionId)
      relayQueueByConnection.remove(previousConnectionId)
    }

    node.connectionId = connectionId
    node.connected = true
    node.connectedAt = connectedAt
    node.disconnectedAt = null
    node.lastHeartbeatAt = connectedAt
    session.updatedAt = connectedAt
    session.status = resolveSessionStatus(session)

    val connection = TopologyHostConnectionRecord(
      sessionId = sessionId,
      nodeId = nodeId,
      connectionId = connectionId,
      connectedAt = connectedAt,
      lastHeartbeatAt = connectedAt,
    )
    connections[connectionId] = connection
    rebindOfflineDeliveriesLocked(sessionId, nodeId, connectionId)
    return connection
  }

  private fun ensureSession(
    ticketRecord: TopologyHostTicketRecord,
    runtime: TopologyHostRuntimeInfo,
    compatibility: TopologyHostCompatibilityDecision,
    occurredAt: Long,
  ): TopologyHostSessionRecord {
    val existingSession = ticketRecord.sessionId?.let { sessions[it] }
    if (existingSession != null) {
      val currentNode = existingSession.nodes[runtime.nodeId]
      if (currentNode != null) {
        currentNode.runtime = runtime
        currentNode.lastHelloAt = occurredAt
      } else {
        existingSession.nodes[runtime.nodeId] = TopologyHostSessionNodeRecord(
          nodeId = runtime.nodeId,
          role = runtime.role,
          runtime = runtime,
          lastHelloAt = occurredAt,
          connected = false,
        )
      }
      existingSession.compatibility = compatibility
      existingSession.updatedAt = occurredAt
      existingSession.status = resolveSessionStatus(existingSession)
      return existingSession
    }

    val session = TopologyHostSessionRecord(
      sessionId = TopologyHostIds.createSessionId(),
      token = ticketRecord.ticket.token,
      ticket = ticketRecord.ticket,
      status = "awaiting-peer",
      compatibility = compatibility,
      createdAt = occurredAt,
      updatedAt = occurredAt,
      nodes = linkedMapOf(
        runtime.nodeId to TopologyHostSessionNodeRecord(
          nodeId = runtime.nodeId,
          role = runtime.role,
          runtime = runtime,
          lastHelloAt = occurredAt,
          connected = false,
        ),
      ),
    )
    sessions[session.sessionId] = session
    ticketRecord.sessionId = session.sessionId
    tokenToSessionId[ticketRecord.ticket.token] = session.sessionId
    return session
  }

  private fun bindTicketOccupancy(
    ticketRecord: TopologyHostTicketRecord,
    runtime: TopologyHostRuntimeInfo,
    sessionId: String,
    connected: Boolean,
    updatedAt: Long,
  ) {
    ticketRecord.occupiedRoles[runtime.role] = TopologyHostTicketOccupancy(
      role = runtime.role,
      nodeId = runtime.nodeId,
      sessionId = sessionId,
      connected = connected,
      updatedAt = updatedAt,
    )
    ticketRecord.updatedAt = updatedAt
  }

  private fun buildRejectedHello(
    hello: TopologyHostNodeHello,
    hostTime: Long,
    rejectionCode: String,
    rejectionMessage: String,
    faultRuleIds: List<String>,
  ): TopologyHostHelloResult {
    recordEvent(
      level = "warn",
      category = "host.hello",
      event = "rejected",
      nodeId = hello.runtime.nodeId,
      data = JSONObject()
        .put("rejectionCode", rejectionCode)
        .put("rejectionMessage", rejectionMessage)
        .put("ticketToken", hello.ticketToken)
        .put("faultRuleIds", faultRuleIds.toJsonStringArray()),
    )
    return TopologyHostHelloResult(
      ack = TopologyHostNodeHelloAck(
        helloId = hello.helloId,
        accepted = false,
        compatibility = TopologyHostCompatibilityDecision(
          level = "rejected",
          reasons = listOf(rejectionMessage),
          enabledCapabilities = emptyList(),
          disabledCapabilities = hello.runtime.capabilities,
        ),
        rejectionCode = rejectionCode,
        rejectionMessage = rejectionMessage,
        hostTime = hostTime,
      ),
      faultRuleIds = faultRuleIds,
    )
  }

  private fun evaluateCompatibility(peerRuntime: TopologyHostRuntimeInfo): TopologyHostCompatibilityDecision {
    if (hostRuntimeInfo.protocolVersion != peerRuntime.protocolVersion) {
      return TopologyHostCompatibilityDecision(
        level = "rejected",
        reasons = listOf("protocolVersion mismatch"),
        enabledCapabilities = emptyList(),
        disabledCapabilities = peerRuntime.capabilities,
      )
    }

    val missingRequired = requiredCapabilities.filterNot { peerRuntime.capabilities.contains(it) }
    if (missingRequired.isNotEmpty()) {
      return TopologyHostCompatibilityDecision(
        level = "rejected",
        reasons = missingRequired.map { "missing capability: $it" },
        enabledCapabilities = emptyList(),
        disabledCapabilities = peerRuntime.capabilities,
      )
    }

    val enabled = peerRuntime.capabilities.filter { hostRuntimeInfo.capabilities.contains(it) }
    val disabled = peerRuntime.capabilities.filterNot { enabled.contains(it) }
    if (hostRuntimeInfo.runtimeVersion != peerRuntime.runtimeVersion) {
      return TopologyHostCompatibilityDecision(
        level = "degraded",
        reasons = listOf("runtimeVersion mismatch"),
        enabledCapabilities = enabled,
        disabledCapabilities = disabled,
      )
    }

    return TopologyHostCompatibilityDecision(
      level = "full",
      reasons = emptyList(),
      enabledCapabilities = enabled,
      disabledCapabilities = disabled,
    )
  }

  private fun matchHelloFault(
    sessionId: String?,
    sourceNodeId: String,
    targetRole: String,
  ): TopologyHostFaultMatch {
    val matched = mutableListOf<TopologyHostFaultRule>()
    synchronized(lock) {
      faultRules.values.forEach { rule ->
        if (!matchesScope(rule, sessionId, sourceNodeId, null, targetRole)) {
          return@forEach
        }
        if (rule.kind == "hello-delay" || rule.kind == "hello-reject") {
          matched += rule
        }
      }
      matched.forEach(::consumeFaultRuleLocked)
    }
    var delayMs: Long? = null
    var rejectionCode: String? = null
    var rejectionMessage: String? = null
    matched.forEach { rule ->
      if (rule.kind == "hello-delay") {
        delayMs = maxOf(delayMs ?: 0L, rule.delayMs ?: 0L)
      }
      if (rule.kind == "hello-reject" && rejectionCode == null) {
        rejectionCode = rule.rejectionCode
        rejectionMessage = rule.rejectionMessage
      }
    }
    return TopologyHostFaultMatch(
      ruleIds = matched.map { it.ruleId },
      delayMs = delayMs,
      rejectionCode = rejectionCode,
      rejectionMessage = rejectionMessage,
    )
  }

  private fun matchRelayFault(
    sessionId: String,
    sourceNodeId: String,
    targetNodeId: String,
    targetRole: String,
    channel: TopologyHostRelayChannel,
  ): TopologyHostFaultMatch {
    val matched = mutableListOf<TopologyHostFaultRule>()
    synchronized(lock) {
      faultRules.values.forEach { rule ->
        if (!matchesScope(rule, sessionId, sourceNodeId, targetNodeId, targetRole)) {
          return@forEach
        }
        val channelMatched = rule.channel == null || rule.channel.equals(channel.name.lowercase(), ignoreCase = true)
        if (channelMatched && (rule.kind == "relay-delay" || rule.kind == "relay-drop" || rule.kind == "relay-disconnect-target")) {
          matched += rule
        }
      }
      matched.forEach(::consumeFaultRuleLocked)
    }
    var delayMs: Long? = null
    var drop = false
    var disconnect = false
    matched.forEach { rule ->
      if (rule.kind == "relay-delay") {
        delayMs = maxOf(delayMs ?: 0L, rule.delayMs ?: 0L)
      }
      if (rule.kind == "relay-drop") {
        drop = true
      }
      if (rule.kind == "relay-disconnect-target") {
        disconnect = true
      }
    }
    return TopologyHostFaultMatch(
      ruleIds = matched.map { it.ruleId },
      delayMs = delayMs,
      dropCurrentRelay = drop,
      disconnectTarget = disconnect,
    )
  }

  private fun normalizeFaultRule(rule: TopologyHostFaultRule): TopologyHostFaultRule {
    return if (rule.remainingHits != null && rule.remainingHits < 1) {
      rule.copy(remainingHits = 1)
    } else {
      rule
    }
  }

  private fun matchesScope(
    rule: TopologyHostFaultRule,
    sessionId: String?,
    sourceNodeId: String?,
    targetNodeId: String?,
    targetRole: String?,
  ): Boolean {
    if (rule.sessionId != null && rule.sessionId != sessionId) {
      return false
    }
    if (rule.sourceNodeId != null && rule.sourceNodeId != sourceNodeId) {
      return false
    }
    if (rule.targetNodeId != null && rule.targetNodeId != targetNodeId) {
      return false
    }
    if (rule.targetRole != null && rule.targetRole != targetRole) {
      return false
    }
    return true
  }

  private fun consumeFaultRuleLocked(rule: TopologyHostFaultRule) {
    val remainingHits = rule.remainingHits ?: return
    if (remainingHits <= 1) {
      faultRules.remove(rule.ruleId)
    } else {
      faultRules[rule.ruleId] = rule.copy(remainingHits = remainingHits - 1)
    }
  }

  private fun resolveRelayChannel(envelope: JSONObject): TopologyHostRelayChannel {
    return when {
      envelope.has("commandName") -> TopologyHostRelayChannel.DISPATCH
      envelope.has("projection") -> TopologyHostRelayChannel.PROJECTION
      envelope.has("snapshot")
        || envelope.has("summaryBySlice")
        || envelope.has("diffBySlice")
        || envelope.has("committedAt")
        || envelope.has("timestamp") -> TopologyHostRelayChannel.RESUME

      else -> TopologyHostRelayChannel.EVENT
    }
  }

  private fun resolveRelayTargetNodeId(envelope: JSONObject): String {
    return when {
      envelope.has("targetNodeId") -> envelope.optString("targetNodeId")
      envelope.has("ownerNodeId") -> envelope.optString("ownerNodeId")
      else -> throw IllegalArgumentException("cannot resolve relay target node")
    }
  }

  private fun enqueueRelayLocked(
    sessionId: String,
    channel: TopologyHostRelayChannel,
    sourceNodeId: String,
    targetNodeId: String,
    targetConnectionId: String?,
    availableAt: Long,
    envelope: JSONObject,
  ): TopologyHostRelayDelivery {
    val sequenceKey = "$sessionId:${channel.name}"
    val nextSequence = (relaySequenceBySessionChannel[sequenceKey] ?: 0) + 1
    relaySequenceBySessionChannel[sequenceKey] = nextSequence
    val delivery = TopologyHostRelayDelivery(
      relayId = TopologyHostIds.createEnvelopeId(),
      sessionId = sessionId,
      channel = channel,
      sourceNodeId = sourceNodeId,
      targetNodeId = targetNodeId,
      connectionId = targetConnectionId ?: "__offline__",
      sequence = nextSequence,
      availableAt = availableAt,
      envelope = JSONObject(envelope.toString()),
    )
    if (targetConnectionId == null) {
      val key = offlineQueueKey(sessionId, targetNodeId)
      val queue = offlineRelayQueueByTarget.getOrPut(key) { mutableListOf() }
      queue += delivery
    } else {
      val queue = relayQueueByConnection.getOrPut(targetConnectionId) { mutableListOf() }
      queue += delivery
    }
    relayCounters[0] += 1
    return delivery
  }

  private fun rebindOfflineDeliveriesLocked(sessionId: String, nodeId: String, connectionId: String) {
    val key = offlineQueueKey(sessionId, nodeId)
    val queued = offlineRelayQueueByTarget.remove(key) ?: return
    val queue = relayQueueByConnection.getOrPut(connectionId) { mutableListOf() }
    queued.forEach { delivery ->
      queue += delivery.copy(connectionId = connectionId)
    }
  }

  private fun drainConnectionQueueLocked(connectionId: String, now: Long, onlyResume: Boolean): List<TopologyHostRelayDelivery> {
    val queue = relayQueueByConnection[connectionId] ?: return emptyList()
    val ready = queue.filter { delivery ->
      delivery.availableAt <= now && (!onlyResume || delivery.channel == TopologyHostRelayChannel.RESUME)
    }
    val remaining = queue.filterNot { ready.contains(it) }
    if (remaining.isEmpty()) {
      relayQueueByConnection.remove(connectionId)
    } else {
      relayQueueByConnection[connectionId] = remaining.toMutableList()
    }
    relayCounters[1] += ready.size
    relayCounters[3] += ready.size
    return ready
  }

  private fun syncPendingCountLocked(sessionId: String, updatedAt: Long) {
    val connectionCount = relayQueueByConnection.values.flatten().count { it.sessionId == sessionId }
    val offlineCount = offlineRelayQueueByTarget.entries
      .filter { it.key.startsWith("$sessionId:") }
      .sumOf { it.value.size }
    val total = connectionCount + offlineCount
    relayPendingBySession[sessionId] = total
    sessions[sessionId]?.let { session ->
      session.relayPendingCount = total
      session.updatedAt = updatedAt
    }
  }

  private fun offlineQueueKey(sessionId: String, nodeId: String): String {
    return "$sessionId:$nodeId"
  }

  private fun resolveSessionStatus(session: TopologyHostSessionRecord): String {
    val nodes = session.nodes.values.toList()
    if (nodes.isEmpty()) {
      return "awaiting-peer"
    }
    if (nodes.all { !it.connected && it.disconnectedAt != null }) {
      return "closed"
    }
    if (nodes.size < 2) {
      return "awaiting-peer"
    }
    if (session.resume.phase == "required") {
      return "resume-required"
    }
    if (session.resume.phase == "resyncing") {
      return "resyncing"
    }
    if (session.compatibility.level == "degraded") {
      return "degraded"
    }
    return "active"
  }

  private fun recordEvent(
    level: String,
    category: String,
    event: String,
    message: String? = null,
    sessionId: String? = null,
    nodeId: String? = null,
    connectionId: String? = null,
    data: JSONObject? = null,
  ) {
    val observation = TopologyHostObservationEvent(
      observationId = TopologyHostIds.createObservationId(),
      timestamp = System.currentTimeMillis(),
      level = level,
      category = category,
      event = event,
      message = message,
      sessionId = sessionId,
      nodeId = nodeId,
      connectionId = connectionId,
      data = data,
    )
    synchronized(lock) {
      recentEvents.addLast(observation)
      while (recentEvents.size > maxObservationEvents) {
        recentEvents.removeFirst()
      }
    }
    when (level) {
      "error" -> logger.error("TopologyHostRuntime", observation.toJson().toString())
      "warn" -> logger.warn("TopologyHostRuntime", observation.toJson().toString())
      "debug" -> logger.debug("TopologyHostRuntime", observation.toJson().toString())
      else -> logger.log("TopologyHostRuntime", observation.toJson().toString())
    }
  }

  private fun cloneTicketRecord(record: TopologyHostTicketRecord): TopologyHostTicketRecord {
    return TopologyHostTicketRecord(
      ticket = record.ticket.copy(
        transportUrls = record.ticket.transportUrls.toList(),
        hostRuntime = record.ticket.hostRuntime.copy(
          capabilities = record.ticket.hostRuntime.capabilities.toList(),
        ),
      ),
      sessionId = record.sessionId,
      occupiedRoles = record.occupiedRoles.mapValues { (_, occupancy) -> occupancy.copy() }.toMutableMap(),
      updatedAt = record.updatedAt,
    )
  }

  private fun cloneSessionRecord(record: TopologyHostSessionRecord): TopologyHostSessionRecord {
    return TopologyHostSessionRecord(
      sessionId = record.sessionId,
      token = record.token,
      ticket = cloneTicketRecord(TopologyHostTicketRecord(record.ticket)).ticket,
      status = record.status,
      compatibility = record.compatibility.copy(
        reasons = record.compatibility.reasons.toList(),
        enabledCapabilities = record.compatibility.enabledCapabilities.toList(),
        disabledCapabilities = record.compatibility.disabledCapabilities.toList(),
      ),
      createdAt = record.createdAt,
      updatedAt = record.updatedAt,
      nodes = record.nodes.mapValues { (_, node) ->
        node.copy(
          runtime = node.runtime.copy(capabilities = node.runtime.capabilities.toList()),
        )
      }.toMutableMap(),
      relayPendingCount = record.relayPendingCount,
      resume = TopologyHostResumeState(
        phase = record.resume.phase,
        pendingNodeIds = record.resume.pendingNodeIds.toMutableList(),
        requiredAt = record.resume.requiredAt,
        startedAt = record.resume.startedAt,
        completedAt = record.resume.completedAt,
        reason = record.resume.reason,
      ),
    )
  }
}
