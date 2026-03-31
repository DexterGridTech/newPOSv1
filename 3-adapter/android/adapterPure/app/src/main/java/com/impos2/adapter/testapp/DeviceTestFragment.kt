package com.impos2.adapter.testapp

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.impos2.adapter.device.DeviceManager
import com.impos2.adapter.interfaces.PowerStatus

class DeviceTestFragment : Fragment() {

    private lateinit var btnGetDeviceInfo: Button
    private lateinit var btnGetSystemStatus: Button
    private lateinit var tvResult: TextView

    private val deviceManager by lazy { DeviceManager.getInstance(requireContext()) }
    private val powerListener: (PowerStatus) -> Unit = { status ->
        appendResult("\n[Power Change] Connected: ${status.powerConnected}, Battery: ${status.batteryLevel}%")
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_device_test, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        btnGetDeviceInfo = view.findViewById(R.id.btnGetDeviceInfo)
        btnGetSystemStatus = view.findViewById(R.id.btnGetSystemStatus)
        tvResult = view.findViewById(R.id.tvResult)

        btnGetDeviceInfo.setOnClickListener {
            val info = deviceManager.getDeviceInfo()
            tvResult.text = """
                Device ID: ${info.id}
                Manufacturer: ${info.manufacturer}
                OS: ${info.os} ${info.osVersion}
                CPU: ${info.cpu}
                Memory: ${info.memory}
                Disk: ${info.disk}
                Network: ${info.network}
                Displays: ${info.displays.size}
            """.trimIndent()
        }

        btnGetSystemStatus.setOnClickListener {
            val status = deviceManager.getSystemStatus()
            tvResult.text = """
                CPU Cores: ${status.cpu.cores}
                Memory: ${status.memory.app}MB / ${status.memory.total}MB (${String.format("%.1f", status.memory.appPercentage)}%)
                Disk: ${String.format("%.1f", status.disk.used)}GB / ${String.format("%.1f", status.disk.total)}GB (${String.format("%.1f", status.disk.overall)}%)
                Power: ${if (status.power.powerConnected) "Connected" else "Disconnected"}
                Battery: ${status.power.batteryLevel}% (${status.power.batteryStatus})
                Health: ${status.power.batteryHealth}
                Updated: ${status.updatedAt}
            """.trimIndent()
        }

        deviceManager.addPowerStatusListener(powerListener)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        deviceManager.removePowerStatusListener(powerListener)
    }

    private fun appendResult(text: String) {
        tvResult.post {
            tvResult.text = tvResult.text.toString() + text
        }
    }
}
