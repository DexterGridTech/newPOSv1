package com.adapterrn84.turbomodules.connector.channels

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.Parcel
import com.adapterrn84.turbomodules.connector.*
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class AidlChannel(
    private val context: ReactApplicationContext,
    private val descriptor: ChannelDescriptor
) : RequestResponseChannel {

    override suspend fun execute(action: String, params: Map<String, String>, timeout: Long): ConnectorResult<String> {
        val startTime = System.currentTimeMillis()
        
        return try {
            val latch = CountDownLatch(1)
            var binder: IBinder? = null
            var bindError: String? = null
            
            val connection = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                    binder = service
                    latch.countDown()
                }
                
                override fun onServiceDisconnected(name: ComponentName?) {
                    binder = null
                }
                
                override fun onBindingDied(name: ComponentName?) {
                    bindError = "Service binding died"
                    latch.countDown()
                }
                
                override fun onNullBinding(name: ComponentName?) {
                    bindError = "Service returned null binding"
                    latch.countDown()
                }
            }
            
            // Parse target: "packageName/serviceName" or just "serviceName"
            val intent = if (descriptor.target.contains("/")) {
                val parts = descriptor.target.split("/")
                Intent().apply {
                    setClassName(parts[0], parts[1])
                }
            } else {
                Intent(descriptor.target)
            }
            
            // Bind to service
            val bound = context.bindService(
                intent,
                connection,
                Context.BIND_AUTO_CREATE
            )
            
            if (!bound) {
                return ConnectorResult.Failure(
                    ConnectorErrorCode.UNKNOWN,
                    "Failed to bind to service: ${descriptor.target}",
                    null,
                    System.currentTimeMillis() - startTime
                )
            }
            
            try {
                // Wait for service connection
                val connected = latch.await(timeout, TimeUnit.MILLISECONDS)
                
                if (!connected || binder == null) {
                    return ConnectorResult.Failure(
                        ConnectorErrorCode.TIMEOUT,
                        bindError ?: "Service connection timeout",
                        null,
                        System.currentTimeMillis() - startTime
                    )
                }
                
                // Prepare data
                val dataHex = params["data"] ?: ""
                val dataBytes = HexUtils.hexToBytes(dataHex)
                
                // Create parcels
                val data = Parcel.obtain()
                val reply = Parcel.obtain()
                
                try {
                    // Write data to parcel
                    data.writeInt(dataBytes.size)
                    data.writeByteArray(dataBytes)
                    
                    // Get transaction code from options or use default
                    val transactionCode = descriptor.options["transactionCode"]?.toIntOrNull() ?: 1
                    
                    // Perform transaction
                    binder?.transact(transactionCode, data, reply, 0)
                    
                    // Read reply
                    reply.setDataPosition(0)
                    val replySize = reply.readInt()
                    val replyBytes = ByteArray(replySize)
                    reply.readByteArray(replyBytes)
                    
                    val duration = System.currentTimeMillis() - startTime
                    val responseHex = HexUtils.bytesToHex(replyBytes)
                    
                    ConnectorResult.Success(responseHex, duration)
                    
                } finally {
                    data.recycle()
                    reply.recycle()
                }
                
            } finally {
                context.unbindService(connection)
            }
            
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            ConnectorResult.Failure(
                ConnectorErrorCode.UNKNOWN,
                e.message ?: "AIDL communication failed",
                e,
                duration
            )
        }
    }

    override fun close() {
        // AidlChannel is stateless, no cleanup needed
    }
}
