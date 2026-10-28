# Production R8 / Proguard rules for Interest Flutter App
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# Kotlin Coroutines & Reflection
-keepclassmembers class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Native JNI entrypoints
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# AndroidX Lifecycle & Architecture Components
-keep class androidx.lifecycle.** { *; }
-dontwarn androidx.lifecycle.**

# Suppress harmless warnings during release compilation
-dontwarn **
-ignorewarnings
