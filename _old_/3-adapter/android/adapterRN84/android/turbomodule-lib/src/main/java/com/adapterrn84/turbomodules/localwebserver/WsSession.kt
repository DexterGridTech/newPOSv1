package com.adapterrn84.turbomodules.localwebserver

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.Socket
import java.util.UUID

class WsSession(private val socket: Socket) {
    val key: String = UUID.randomUUID().toString()
    private val out = socket.getOutputStream()
    @Volatile var isOpen = true

    fun send(text: String) {
        if (!isOpen) return
        try {
            val data = text.toByteArray(Charsets.UTF_8)
            val len = data.size
            val frame = ByteArrayOutputStream()
            frame.write(0x81)
            when {
                len <= 125 -> frame.write(len)
                len <= 65535 -> { frame.write(126); frame.write(len shr 8); frame.write(len and 0xFF) }
                else -> {
                    frame.write(127)
                    for (i in 7 downTo 0) frame.write((len.toLong() shr (i * 8)).toInt() and 0xFF)
                }
            }
            frame.write(data)
            synchronized(out) { out.write(frame.toByteArray()); out.flush() }
        } catch (e: Exception) {
            isOpen = false
            close()
        }
    }

    fun sendPong(payload: ByteArray) {
        if (!isOpen) return
        try {
            val frame = ByteArrayOutputStream()
            frame.write(0x8A)
            frame.write(payload.size)
            frame.write(payload)
            synchronized(out) { out.write(frame.toByteArray()); out.flush() }
        } catch (e: Exception) {
            isOpen = false
            close()
        }
    }

    fun close() {
        if (!isOpen) return
        isOpen = false
        try {
            val frame = byteArrayOf(0x88.toByte(), 0x00)
            synchronized(out) { out.write(frame); out.flush() }
        } catch (_: Exception) {}
        try { socket.close() } catch (_: Exception) {}
    }
}

class WsFrameReader(private val ins: InputStream, private val onPing: (ByteArray) -> Unit = {}) {
    fun readFrame(): String? {
        while (true) {
            return try {
                val b0 = ins.read(); if (b0 < 0) return null
                val b1 = ins.read(); if (b1 < 0) return null
                val opcode = b0 and 0x0F
                if (opcode == 0x8) return null
                val masked = (b1 and 0x80) != 0
                var payloadLen = (b1 and 0x7F).toLong()
                if (payloadLen == 126L) {
                    payloadLen = ((ins.read() shl 8) or ins.read()).toLong()
                } else if (payloadLen == 127L) {
                    payloadLen = 0; repeat(8) { payloadLen = (payloadLen shl 8) or ins.read().toLong() }
                }
                if (payloadLen > Int.MAX_VALUE) return null
                val mask = if (masked) ByteArray(4) { ins.read().toByte() } else null
                val data = ByteArray(payloadLen.toInt())
                var read = 0
                while (read < data.size) {
                    val n = ins.read(data, read, data.size - read)
                    if (n < 0) return null
                    read += n
                }
                if (mask != null) data.forEachIndexed { i, _ -> data[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte() }
                if (opcode == 0x9) { onPing(data); continue }
                String(data, Charsets.UTF_8)
            } catch (_: Exception) { null }
        }
    }
}
