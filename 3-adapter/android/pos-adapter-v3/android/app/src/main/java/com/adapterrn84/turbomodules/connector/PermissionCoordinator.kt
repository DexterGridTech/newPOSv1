package com.adapterrn84.turbomodules.connector

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap

class PermissionCoordinator(private val context: ReactApplicationContext) {

    private val permissionRequests = ConcurrentHashMap<String, CompletableDeferred<Boolean>>()

    suspend fun ensurePermissions(channelType: ChannelType) {
        val permissions = getRequiredPermissions(channelType)
        if (permissions.isEmpty()) return

        permissions.forEach { permission ->
            if (!hasPermission(permission)) {
                requestPermission(permission)
            }
        }
    }

    private fun getRequiredPermissions(channelType: ChannelType): List<String> = when (channelType) {
        ChannelType.BLUETOOTH -> if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            listOf(
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            )
        } else {
            listOf(Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN)
        }
        ChannelType.HID -> listOf(Manifest.permission.CAMERA)
        else -> emptyList()
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            context.currentActivity ?: context,
            permission
        ) == PackageManager.PERMISSION_GRANTED
    }

    private suspend fun requestPermission(permission: String) {
        val deferred = CompletableDeferred<Boolean>()
        val requestCode = permission.hashCode() and 0xFFFF

        permissionRequests[permission] = deferred

        withContext(Dispatchers.Main) {
            val activity = context.currentActivity
                ?: throw IllegalStateException("No activity available for permission request")

            ActivityCompat.requestPermissions(
                activity,
                arrayOf(permission),
                requestCode
            )
        }

        val granted = try {
            withTimeout(30000) { deferred.await() }
        } catch (e: Exception) {
            permissionRequests.remove(permission)
            false
        }

        if (!granted) {
            throw SecurityException("Permission denied: $permission")
        }
    }

    fun onPermissionResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        permissions.forEachIndexed { index, permission ->
            permissionRequests.remove(permission)?.complete(
                grantResults.getOrNull(index) == PackageManager.PERMISSION_GRANTED
            )
        }
    }
}
