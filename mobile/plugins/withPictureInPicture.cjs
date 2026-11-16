const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withPictureInPicture(config) {
  return withAndroidManifest(config, config => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$['android:supportsPictureInPicture'] = 'true';
    return config;
  });
};
