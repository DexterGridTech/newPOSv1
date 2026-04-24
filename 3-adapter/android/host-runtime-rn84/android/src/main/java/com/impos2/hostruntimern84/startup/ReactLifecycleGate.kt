package com.impos2.hostruntimern84.startup

import android.os.Build

internal object ReactLifecycleGate {
  fun shouldForwardToReact(isReactContextReady: Boolean): Boolean = isReactContextReady

  fun canLaunchSecondaryDisplay(apiLevel: Int = Build.VERSION.SDK_INT): Boolean {
    return apiLevel >= Build.VERSION_CODES.O
  }
}
