# Only the unused optional AV1 JNI interface is absent from this WebRTC artifact.
# AV1 is excluded from all native peer codec preferences in src/videoCodecs.js.
-dontwarn org.webrtc.Dav1dDecoder$Natives

# Room instantiates generated database implementations reflectively at startup.
-keep class * extends androidx.room.RoomDatabase { public <init>(); }

# ONNX Runtime uses JNI names that must survive release shrinking.
-keep class ai.onnxruntime.** { *; }
