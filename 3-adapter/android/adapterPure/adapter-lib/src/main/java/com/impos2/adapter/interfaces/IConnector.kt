package com.impos2.adapter.interfaces

import androidx.activity.ComponentActivity

interface IConnector {
  fun call(activity: ComponentActivity, request: ConnectorRequest, callback: (ConnectorResponse) -> Unit)
  fun isAvailable(channel: ChannelDescriptor): Boolean
  fun getAvailableTargets(type: ChannelType): List<String>
}
