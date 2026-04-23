package com.impos2.adapterv2.scripts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ScriptJsonLiteralParserTest {
  @Test
  fun decodesEscapedJsonStringLiterals() {
    assertEquals("hello\nworld", parseScriptJsonLiteral("\"hello\\nworld\""))
    assertEquals("quote: \"x\"", parseScriptJsonLiteral("\"quote: \\\"x\\\"\""))
    assertEquals("slash: \\", parseScriptJsonLiteral("\"slash: \\\\\""))
  }

  @Test
  fun decodesUnicodeEscapes() {
    assertEquals("\u4F60\u597D", parseScriptJsonLiteral("\"\\u4F60\\u597D\""))
  }

  @Test
  fun preservesPrimitiveLiteralBehavior() {
    assertNull(parseScriptJsonLiteral("null"))
    assertEquals(true, parseScriptJsonLiteral("true"))
    assertEquals(false, parseScriptJsonLiteral("false"))
    assertEquals(42L, parseScriptJsonLiteral("42"))
    assertEquals(3.5, parseScriptJsonLiteral("3.5"))
  }

  @Test
  fun preservesRawObjectAndArrayLiteralBehavior() {
    assertEquals("""{"value":"x"}""", parseScriptJsonLiteral("""{"value":"x"}"""))
    assertEquals("""["x","y"]""", parseScriptJsonLiteral("""["x","y"]"""))
  }
}
