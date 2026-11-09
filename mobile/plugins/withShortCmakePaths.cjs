const { withAppBuildGradle } = require("expo/config-plugins");

// Keep generated native object paths within Windows tool limits.
module.exports = function withShortCmakePaths(config) {
  return withAppBuildGradle(config, (mod) => {
    // Leave room for CMake's 32-character hash plus long codegen filenames.
    // A limit below their fixed prefix prevents hashing instead of helping it.
    const marker = 'arguments "-DCMAKE_OBJECT_PATH_MAX=250"';
    if (!mod.modResults.contents.includes(marker)) {
      const source = mod.modResults.contents;
      if (mod.modResults.language !== "groovy" || !source.includes("defaultConfig {")) {
        throw new Error("Unsupported Android Gradle template for CMake path settings.");
      }
      mod.modResults.contents = source.replace(
        "defaultConfig {",
        `defaultConfig {\n        externalNativeBuild { cmake { ${marker} } }`,
      );
    }
    return mod;
  });
};
