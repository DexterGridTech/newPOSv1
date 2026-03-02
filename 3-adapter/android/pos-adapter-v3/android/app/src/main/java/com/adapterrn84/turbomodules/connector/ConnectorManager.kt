package com.adapterrn84.turbomodules.connector

import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

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
            // TODO: 实现具体的可用性检查
            true
        } catch (e: Exception) {
            false
        }
    }

    fun getAvailableTargets(type: ChannelType): List<String> {
        // TODO: 实现具体的设备枚举
        return emptyList()
    }

    fun getEventDispatcher(): EventDispatcher = eventDispatcher

    fun getPermissionCoordinator(): PermissionCoordinator = permissionCoordinator

    fun cleanup() {
        channelRegistry.closeAll()
        passiveChannelManager.cleanup()
        eventDispatcher.cleanup()
        scope.cancel()
    }
}
