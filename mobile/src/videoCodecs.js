import { RTCRtpReceiver } from 'react-native-webrtc';

// The bundled Android WebRTC artifact has an incomplete optional AV1 JNI class.
// Negotiate the working codecs (H.264/VP8/VP9) instead of selecting that decoder.
export function excludeUnsupportedAv1(peer) {
  const codecs = RTCRtpReceiver.getCapabilities('video').codecs.filter((codec) => codec.mimeType.toLowerCase() !== 'video/av1');
  for (const transceiver of peer.getTransceivers()) transceiver.setCodecPreferences(codecs);
}
