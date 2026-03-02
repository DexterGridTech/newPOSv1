package com.adapterrn84.turbomodules.connector

import com.adapterrn84.turbomodules.connector.channels.*
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope

class ChannelFactory(
    private val context: ReactApplicationContext,
    private val scope: CoroutineScope,
    private val eventDispatcher: EventDispatcher
) {
    fun createRequestResponseChannel(descriptor: ChannelDescriptor): RequestResponseChannel {
        return when (descriptor.type) {
            ChannelType.INTENT -> IntentChannel(context, descriptor, eventDispatcher)
            ChannelType.NETWORK -> NetworkChannel(descriptor)
            ChannelType.SDK -> SdkChannel(descriptor)
            ChannelType.USB -> UsbChannel(context, descriptor)
            ChannelType.SERIAL -> SerialChannel(descriptor)
            ChannelType.BLUETOOTH -> BluetoothChannel(context, descriptor)
            ChannelType.AIDL -> AidlChannel(context, descriptor)
            ChannelType.HID -> throw IllegalArgumentException("HID only supports STREAM mode")
        }
    }

    fun createStreamChannel(descriptor: ChannelDescriptor): StreamChannel {
        return when (descriptor.type) {
            ChannelType.USB -> UsbStreamChannel(context, descriptor, scope)
            ChannelType.SERIAL -> SerialStreamChannel(descriptor, scope)
            ChannelType.BLUETOOTH -> BluetoothStreamChannel(context, descriptor, scope)
            ChannelType.HID -> HidStreamChannel(context, descriptor, scope, eventDispatcher)
            else -> throw IllegalArgumentException("${descriptor.type} does not support STREAM mode")
        }
    }
}
