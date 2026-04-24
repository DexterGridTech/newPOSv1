package com.impos2.mixccateringassemblyrn84.startup

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReactLifecycleGateTest {
  @Test
  fun `forwards to react only when context is ready`() {
    assertTrue(ReactLifecycleGate.shouldForwardToReact(isReactContextReady = true))
    assertFalse(ReactLifecycleGate.shouldForwardToReact(isReactContextReady = false))
  }

  @Test
  fun `secondary display launch requires api 26 or above`() {
    assertFalse(ReactLifecycleGate.canLaunchSecondaryDisplay(apiLevel = 25))
    assertTrue(ReactLifecycleGate.canLaunchSecondaryDisplay(apiLevel = 26))
    assertTrue(ReactLifecycleGate.canLaunchSecondaryDisplay(apiLevel = 36))
  }
}
