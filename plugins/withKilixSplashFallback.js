const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo SDK 54 Android safeguard:
 * expo-splash-screen can leave a reference to @drawable/splashscreen_logo
 * during CNG generation. Copy the declared splash image to that exact
 * resource name so Android resource linking can never fail on a missing
 * splashscreen_logo drawable.
 */
module.exports = function withKilixSplashFallback(config) {
  // iOS: declare only the permissions actually used by Kilix.
  // This keeps the existing app behavior unchanged while ensuring App Store/iOS
  // permission prompts have the required usage descriptions.
  config = withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults.NSPhotoLibraryUsageDescription =
      'يستخدم Kilix مكتبة الصور لاختيار صور وفيديوهات المنتجات ورفعها داخل التطبيق.';
    iosConfig.modResults.NSCameraUsageDescription =
      'يستخدم Kilix الكاميرا لالتقاط صور المنتجات والبحث بالصور داخل التطبيق.';
    // Kilix does not record audio or use the microphone. Some media libraries
    // may declare a microphone usage description automatically, so remove it
    // from the final iOS Info.plist to avoid declaring an unused permission.
    delete iosConfig.modResults.NSMicrophoneUsageDescription;
    return iosConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const source = path.join(
        config.modRequest.projectRoot,
        'assets',
        'images',
        'kilix-splash.png'
      );
      const drawableDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'drawable'
      );
      const target = path.join(drawableDir, 'splashscreen_logo.png');

      if (!fs.existsSync(source)) {
        throw new Error(`Kilix splash image not found: ${source}`);
      }

      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(source, target);
      return config;
    },
  ]);
};
