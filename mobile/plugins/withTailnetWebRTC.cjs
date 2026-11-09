const { withMainApplication } = require('expo/config-plugins');

const trial = 'WebRTC-NetworkMonitorAutoDetect/requestVPN:true,includeOtherUidNetworks:true,getAllNetworksFromCache:false/';
const marker = '// atchacha: collect VPN interfaces before WebRTC initializes';
function configureApplication(source) {
  if (source.includes(marker)) return source;
  if (!source.includes('super.onCreate()')) throw new Error('Unsupported Kotlin MainApplication template.');
  return source.replace('super.onCreate()', `super.onCreate()\n    ${marker}\n    val homecamWebRtcOptions = com.oney.WebRTCModule.WebRTCModuleOptions.getInstance()\n    homecamWebRtcOptions.fieldTrials = (homecamWebRtcOptions.fieldTrials ?: "") + "${trial}"`);
}
module.exports = function withTailnetWebRTC(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Tailscale WebRTC setup requires Kotlin MainApplication.');
    mod.modResults.contents = configureApplication(mod.modResults.contents);
    return mod;
  });
};
module.exports.configureApplication = configureApplication;
