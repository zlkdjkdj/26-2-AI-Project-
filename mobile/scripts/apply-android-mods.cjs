// Apply maintained config plugins to an existing local native build without
// regenerating the entire project or discarding its CMake compilation cache.
const path = require('node:path');
const { compileModsAsync, AndroidConfig } = require('expo/config-plugins');
const projectRoot = path.resolve(__dirname, '..');
let config = require('../app.json').expo;
for (const name of ['withTailnetWebRTC', 'withStandaloneBundle']) {
  config = require(`../plugins/${name}.cjs`)(config);
}
config = AndroidConfig.Version.withVersion(config);
// SDK 58 prebuild icon mod; keep generated launcher resources in sync with app.json.
// Native files remain generated rather than hand-edited.
const { withAndroidIcons } = require('@expo/prebuild-config/build/plugins/icons/withAndroidIcons');
config = withAndroidIcons(config);
compileModsAsync(config, { projectRoot, platforms: ['android'], assertMissingModProviders: true })
  .catch((error) => { console.error(error.message); process.exitCode = 1; });
