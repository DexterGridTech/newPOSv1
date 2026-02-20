# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# LocalWebServer Service 相关
-keep class com.impos2.turbomodules.localwebserver.** { *; }
-keep class com.impos2.turbomodules.LocalWebServerTurboModule { *; }

# Ktor 相关
-keep class io.ktor.** { *; }
-keepclassmembers class io.ktor.** { *; }

# Kotlin 协程
-keepclassmembernames class kotlinx.** { *; }

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
