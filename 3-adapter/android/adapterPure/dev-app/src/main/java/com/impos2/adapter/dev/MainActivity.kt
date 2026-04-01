package com.impos2.adapter.dev

import android.os.Bundle
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.impos2.adapter.connector.ConnectorManager
import com.impos2.adapter.dev.ui.TestHomeFragment
import com.impos2.adapter.dev.ui.TestModule
import com.impos2.adapter.dev.ui.appcontrol.AppControlTestFragment
import com.impos2.adapter.dev.ui.connector.ConnectorTestFragment
import com.impos2.adapter.dev.ui.device.DeviceTestFragment
import com.impos2.adapter.dev.ui.logger.LoggerTestFragment
import com.impos2.adapter.dev.ui.scripts.ScriptEngineTestFragment
import com.impos2.adapter.dev.ui.storage.StateStorageTestFragment
import com.impos2.adapter.dev.ui.webserver.WebServerTestFragment

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
      TestModule.LOCAL_WEBSERVER -> WebServerTestFragment()
      TestModule.APP_CONTROL -> AppControlTestFragment()
    }
    supportFragmentManager
      .beginTransaction()
      .replace(android.R.id.content, fragment)
      .addToBackStack(module.name)
      .commit()
  }
}
