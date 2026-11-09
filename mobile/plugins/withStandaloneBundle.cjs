const { withAppBuildGradle } = require('expo/config-plugins');

// Use RN's plain-JavaScript bundle mode; Hermes runtime remains enabled.
// This omits the optional Windows hermesc build step (blocked by OS policy).
module.exports = function withStandaloneBundle(config) {
  return withAppBuildGradle(config, (mod) => {
    const marker = '// atchacha: standalone plain-JS bundle';
    const rules = 'android.buildTypes.release.proguardFile file("../../homecam-proguard.pro")';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `\n${marker}\nandroid.buildTypes.release.proguardFile file("../../homecam-proguard.pro")\nafterEvaluate {\n    tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {\n        hermesEnabled.set(false)\n        minifyEnabled.set(true)\n    }\n}\n`;
    }
    if (!mod.modResults.contents.includes(rules)) mod.modResults.contents += `\n${rules}\n`;
    return mod;
  });
};
