package com.impos2.mixcretailrn84v2.startup

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Bundle
import com.impos2.adapter.device.DeviceManager

object LaunchOptionsFactory {

    fun create(context: Context, displayIndex: Int): Bundle {
        val deviceInfo = DeviceManager.getInstance(context.applicationContext).getDeviceInfo()
        val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        return Bundle().apply {
            putString("deviceId", deviceInfo.id)
            putString("screenMode", "desktop")
            putInt("displayCount", displayManager.displays.size)
            putInt("displayIndex", displayIndex)
        }
    }
}
