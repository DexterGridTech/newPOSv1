package com.impos2.posadapter

import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.impos2.posadapter.turbomodules.PosAdapterTurboPackage

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "PosAdapter"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val module = reactInstanceManager
            ?.currentReactContext
            ?.getNativeModule(com.impos2.posadapter.turbomodules.connector.ConnectorTurboModule::class.java)
        if (module?.onKeyEvent(event) == true) return true
        return super.dispatchKeyEvent(event)
    }
}
