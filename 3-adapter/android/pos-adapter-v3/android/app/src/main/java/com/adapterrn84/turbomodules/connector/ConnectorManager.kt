package com.adapterrn84.turbomodules.connector

import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.hardware.usb.UsbManager
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.io.File

class ConnectorManager(private val context: ReactApplicationContext) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val eventDispatcher = EventDispatcher(context, scope)
    private val permissionCoordinator = PermissionCoordinator(context)
    private val channelFactory = ChannelFactory(context, scope, eventDispatcher)
    private val channelRegistry = ChannelRegistry(scope, eventDispatcher)
    private val passiveChannelManager = PassiveChannelManager(context, scope, eventDispatcher)

    suspend fun call(
        descriptor: ChannelDescriptor,
        action: String,
        params: Map<String, String>,
        timeout: Long
    ): ConnectorResult<String> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()

        try {
            // 检查并请求权限
            permissionCoordinator.ensurePermissions(descriptor.type)

            val permissionElapsed = System.currentTimeMillis() - startTime
            val remainingTimeout = (timeout - permissionElapsed).coerceAtLeast(1000)

            // 创建通道并执行
            val channel = channelFactory.createRequestResponseChannel(descriptor)

            try {
                withTimeout(remainingTimeout) {
                    channel.execute(action, params, remainingTimeout)
                }
            } finally {
                channel.close()
            }
        } catch (e: TimeoutCancellationException) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.TIMEOUT,
                "Operation timeout after ${duration}ms",
                e,
                duration
            )
        } catch (e: SecurityException) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.PERMISSION_DENIED,
                e.message ?: "Permission denied",
                e,
                duration
            )
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "Unknown error",
                e,
                duration
            )
        }
    }

    suspend fun subscribe(descriptor: ChannelDescriptor): String {
        permissionCoordinator.ensurePermissions(descriptor.type)
        val channel = channelFactory.createStreamChannel(descriptor)
        return channelRegistry.register(channel)
    }

    suspend fun unsubscribe(channelId: String) {
        channelRegistry.unregister(channelId)
    }

    suspend fun isAvailable(descriptor: ChannelDescriptor): Boolean {
        return try {
            permissionCoordinator.ensurePermissions(descriptor.type)
            when (descriptor.type) {
                ChannelType.USB -> {
                    val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
                    usbManager.deviceList.containsKey(descriptor.target)
                }
                ChannelType.SERIAL -> File(descriptor.target).exists()
                ChannelType.BLUETOOTH -> {
                    val bt = BluetoothAdapter.getDefaultAdapter()
                    bt != null && bt.isEnabled
                }
                ChannelType.INTENT -> {
                    val pm = context.packageManager
                    pm.getLaunchIntentForPackage(descriptor.target) != null
                }
                else -> true // AIDL, NETWORK, SDK, HID 默认可用
            }
        } catch (e: Exception) {
            false
        }
    }

    fun getAvailableTargets(type: ChannelType): List<String> {
        return try {
            when (type) {
                ChannelType.USB -> {
                    val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
                    usbManager.deviceList.keys.toList()
                }
                ChannelType.SERIAL -> {
                    listOf("/dev/ttyS0", "/dev/ttyS1", "/dev/ttyUSB0", "/dev/ttyUSB1")
                        .filter { File(it).exists() }
                }
                ChannelType.BLUETOOTH -> {
                    val bt = BluetoothAdapter.getDefaultAdapter()
                    if (bt != null && bt.isEnabled) {
                        bt.bondedDevices?.map { it.address } ?: emptyList()
                    } else {
                        emptyList()
                    }
                }
                ChannelType.INTENT -> {
                    val pm = context.packageManager
                    pm.getInstalledPackages(0).map { it.packageName }
                }
                ChannelType.HID -> {
                    // HID 设备（扫码枪/键盘）返回默认 target
                    listOf("scanner", "keyboard")
                }
                else -> emptyList() // AIDL, NETWORK, SDK 无法枚举
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun getEventDispatcher(): EventDispatcher = eventDispatcher

    fun getPermissionCoordinator(): PermissionCoordinator = permissionCoordinator

    fun getChannelRegistry(): ChannelRegistry = channelRegistry

    fun cleanup() {
        channelRegistry.closeAll()
        passiveChannelManager.cleanup()
        eventDispatcher.cleanup()
        scope.cancel()
    }
}
