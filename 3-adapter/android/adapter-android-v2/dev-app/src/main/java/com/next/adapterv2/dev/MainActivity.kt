package com.next.adapterv2.dev

import android.os.Bundle
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.next.adapterv2.connector.ConnectorManager
import com.next.adapterv2.dev.ui.TestHomeFragment
import com.next.adapterv2.dev.ui.TestModule
import com.next.adapterv2.dev.ui.appcontrol.AppControlTestFragment
import com.next.adapterv2.dev.ui.connector.ConnectorTestFragment
import com.next.adapterv2.dev.ui.device.DeviceTestFragment
import com.next.adapterv2.dev.ui.logger.LoggerTestFragment
import com.next.adapterv2.dev.ui.scripts.ScriptEngineTestFragment
import com.next.adapterv2.dev.ui.storage.StateStorageTestFragment
import com.next.adapterv2.dev.ui.topologyhost.TopologyHostTestFragment

class MainActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val containerId = android.R.id.content
    if (savedInstanceState == null) {
      supportFragmentManager
        .beginTransaction()
        .replace(containerId, TestHomeFragment(::openModule))
        .commitNow()
    }
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (ConnectorManager.getInstance(this).handleKeyEvent(event)) {
      return true
    }
    return super.dispatchKeyEvent(event)
  }

  private fun openModule(module: TestModule) {
    val fragment: Fragment = when (module) {
      TestModule.DEVICE -> DeviceTestFragment()
      TestModule.LOGGER -> LoggerTestFragment()
      TestModule.SCRIPT_ENGINE -> ScriptEngineTestFragment()
      TestModule.STATE_STORAGE -> StateStorageTestFragment()
      TestModule.CONNECTOR -> ConnectorTestFragment()
      TestModule.TOPOLOGY_HOST -> TopologyHostTestFragment()
      TestModule.APP_CONTROL -> AppControlTestFragment()
    }
    supportFragmentManager
      .beginTransaction()
      .replace(android.R.id.content, fragment)
      .addToBackStack(module.name)
      .commit()
  }
}
