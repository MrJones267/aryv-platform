# ARYV Mobile App - Production ProGuard Rules
# These rules optimize the app for production while ensuring functionality is preserved

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# React Native specific rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# React Native Hermes
-keep class com.facebook.hermes.reactexecutor.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native WebRTC
-keep class org.webrtc.** { *; }
-keep class com.oney.WebRTCModule.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Socket.io
-keep class io.socket.** { *; }
-keep class com.github.nkzawa.** { *; }

# React Navigation
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.reanimated.** { *; }

# Redux Persist
-keep class redux.** { *; }
-keep class com.rt2zz.reactnativepersist.** { *; }

# React Native Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# React Native Camera
-keep class com.lwansbrough.RCTCamera.** { *; }
-keep class org.reactnative.camera.** { *; }

# React Native Device Info
-keep class com.learnium.RNDeviceInfo.** { *; }

# React Native Async Storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# React Native NetInfo
-keep class com.reactnativecommunity.netinfo.** { *; }

# React Native Permissions
-keep class com.zoontek.rnpermissions.** { *; }

# React Native Geolocation
-keep class com.reactnativecommunity.geolocation.** { *; }

# React Native Maps (if used)
-keep class com.airbnb.android.react.maps.** { *; }

# OkHttp (used by many React Native libraries)
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson (used for JSON parsing)
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep all model classes for API responses
-keep class com.aryvmobile.models.** { *; }
-keep class com.aryvmobile.api.** { *; }

# Keep enum values
-keepclassmembers enum * { *; }

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep native method names
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep classes with JNI interfaces
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }

# Remove logging calls
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Optimization settings
-optimizationpasses 5
-allowaccessmodification
-mergeinterfacesaggressively

# Keep React Native Bundle assets
-keep class * extends com.facebook.react.bridge.ReactPackage { *; }

# WebView
-keep class * extends android.webkit.WebViewClient
-keep class * extends android.webkit.WebChromeClient

# Keep BuildConfig
-keep class com.aryvmobile.BuildConfig { *; }

# Android Support/AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Multidex
-keep class androidx.multidex.** { *; }

# Network Security
-keep class android.security.NetworkSecurityPolicy {
    public boolean isCleartextTrafficPermitted(...);
}

# Keep exception classes
-keep public class * extends java.lang.Exception

# Application class
-keep public class com.aryvmobile.MainApplication { *; }

# Additional React Native optimizations
-keep class com.facebook.react.ReactApplication { *; }
-keep class com.facebook.react.ReactActivity { *; }
-keep class com.facebook.react.ReactActivityDelegate { *; }
-keep class com.facebook.react.ReactRootView { *; }
-keep class com.facebook.react.ReactInstanceManager { *; }

# Suppress warnings for third-party libraries
-dontwarn javax.annotation.**
-dontwarn com.squareup.okhttp.**
-dontwarn com.google.common.**
-dontwarn com.facebook.infer.**
-dontwarn com.facebook.react.devsupport.**