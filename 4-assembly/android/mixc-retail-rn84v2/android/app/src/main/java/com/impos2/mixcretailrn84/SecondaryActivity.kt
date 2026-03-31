package com.impos2.mixcretailrn84

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.adapterrn84.turbomodules.device.DeviceManager

class SecondaryActivity : ReactActivity() {

    override fun getMainComponentName(): String = "MixcRetailRN84"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
            override fun getLaunchOptions(): Bundle {
                val deviceId = DeviceManager.getInstance(applicationContext).getOrGenerateDeviceId()
                val dm = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
                return Bundle().apply {
                    putString("deviceId", deviceId)
                    putString("screenMode", "desktop")
                    putInt("displayCount", dm.displays.size)
                    putInt("displayIndex", 1)
                }
            }
        }
}
