const { withMainApplication } = require('expo/config-plugins');

const trial = 'WebRTC-NetworkMonitorAutoDetect/requestVPN:true,includeOtherUidNetworks:true,getAllNetworksFromCache:false/';
const marker = '// atchacha: collect VPN interfaces before WebRTC initializes';
const factoryMarker = '// atchacha: let OS routing handle the Tailnet interface';
function configureApplication(source) {
  if (!source.includes('super.onCreate()')) throw new Error('Unsupported Kotlin MainApplication template.');
  if (!source.includes(marker)) {
    source = source.replace('super.onCreate()', `super.onCreate()\n    ${marker}\n    val homecamWebRtcOptions = com.oney.WebRTCModule.WebRTCModuleOptions.getInstance()\n    homecamWebRtcOptions.fieldTrials = (homecamWebRtcOptions.fieldTrials ?: "") + "${trial}"`);
  }
  if (!source.includes('loadReactNative(this)')) throw new Error('Missing React Native initialization anchor.');
  if (!source.includes(factoryMarker)) {
    source = source.replace('loadReactNative(this)', `${factoryMarker}\n    val homecamFactoryOptions = org.webrtc.PeerConnectionFactory.Options()\n    homecamFactoryOptions.disableNetworkMonitor = true\n    homecamFactoryOptions.networkIgnoreMask = org.webrtc.PeerConnectionFactory.Options.ADAPTER_TYPE_LOOPBACK\n    homecamFactoryOptions.disableEncryption = false\n    homecamWebRtcOptions.peerConnectionFactoryOptions = homecamFactoryOptions\n    loadReactNative(this)`);
  }
  return source;
}
module.exports = function withTailnetWebRTC(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Tailscale WebRTC setup requires Kotlin MainApplication.');
    mod.modResults.contents = configureApplication(mod.modResults.contents);
    return mod;
  });
};
module.exports.configureApplication = configureApplication;
