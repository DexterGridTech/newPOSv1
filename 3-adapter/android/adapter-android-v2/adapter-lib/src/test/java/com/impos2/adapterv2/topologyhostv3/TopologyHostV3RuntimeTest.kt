package com.impos2.adapterv2.topologyhostv3

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TopologyHostV3RuntimeTest {
  @Test
  fun acceptsOneMasterAndOneSlaveWithoutTicket() {
    val runtime = TopologyHostV3Runtime()

    val masterAck = runtime.processHello(
      connectionId = "c-master",
      hello = TopologyHostV3Hello(
        helloId = "h-master",
        runtime = createRuntimeInfo("master-node", "master-device", "MASTER"),
        sentAt = 1L,
      ),
    )
    val slaveAck = runtime.processHello(
      connectionId = "c-slave",
      hello = TopologyHostV3Hello(
        helloId = "h-slave",
        runtime = createRuntimeInfo("slave-node", "slave-device", "SLAVE"),
        sentAt = 2L,
      ),
    )

    assertTrue(masterAck.accepted)
    assertTrue(slaveAck.accepted)
    assertNotNull(slaveAck.sessionId)
    assertEquals(slaveAck.sessionId, masterAck.sessionId)

    val snapshot = runtime.getDiagnosticsSnapshot()
    assertEquals(2, snapshot.peers.size)
    assertEquals(1, runtime.getStats().sessionCount)
  }

  @Test
  fun rejectsDuplicateMasterOccupancy() {
    val runtime = TopologyHostV3Runtime()
    runtime.processHello(
      connectionId = "c-master-1",
      hello = TopologyHostV3Hello(
        helloId = "h-master-1",
        runtime = createRuntimeInfo("master-node-1", "master-device-1", "MASTER"),
        sentAt = 1L,
      ),
    )

    val duplicateAck = runtime.processHello(
      connectionId = "c-master-2",
      hello = TopologyHostV3Hello(
        helloId = "h-master-2",
        runtime = createRuntimeInfo("master-node-2", "master-device-2", "MASTER"),
        sentAt = 2L,
      ),
    )

    assertFalse(duplicateAck.accepted)
    assertEquals("ROLE_OCCUPIED", duplicateAck.rejectionCode)
  }

  @Test
  fun diagnosticsContainCurrentPairMetadata() {
    val runtime = TopologyHostV3Runtime()
    runtime.markRunning()
    runtime.processHello(
      connectionId = "c-master",
      hello = TopologyHostV3Hello(
        helloId = "h-master",
        runtime = createRuntimeInfo("master-node", "master-device", "MASTER"),
        sentAt = 1L,
      ),
    )

    val snapshot = runtime.getDiagnosticsSnapshot()
    assertEquals(TOPOLOGY_HOST_V3_MODULE_NAME, snapshot.moduleName)
    assertEquals("running", snapshot.state)
    assertEquals(1, snapshot.peers.size)
    assertEquals("master-node", snapshot.peers.first().nodeId)
  }

  private fun createRuntimeInfo(nodeId: String, deviceId: String, instanceMode: String): TopologyHostV3RuntimeInfo {
    return TopologyHostV3RuntimeInfo(
      nodeId = nodeId,
      deviceId = deviceId,
      instanceMode = instanceMode,
      displayMode = if (instanceMode == "MASTER") "PRIMARY" else "SECONDARY",
      standalone = instanceMode == "MASTER",
      protocolVersion = TopologyHostV3Defaults.DEFAULT_PROTOCOL_VERSION,
      capabilities = listOf("state-sync", "command-relay", "request-mirror"),
    )
  }
}
