package com.impos2.adapterv2.automation

object AutomationMessageCodec {
  fun encode(message: String): ByteArray = "${message.trimEnd()}\n".toByteArray(Charsets.UTF_8)

  fun decode(line: String): String = line.trim()
}

