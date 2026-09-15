// React Native CLI config — bundle the redesign's font families (feature 009).
// Drop the static `.ttf` weights into `assets/fonts/` (Bricolage Grotesque 600/700/800;
// Public Sans 400/500/600/700/800), then run `npx react-native-asset` to link them
// (Android `assets/fonts`, iOS Info.plist `UIAppFonts`). Rebuild the app afterwards.
module.exports = {
  assets: ['./assets/fonts'],
  dependencies: {
    // The QR decoder is Android-only (025, 2026-09-24). iOS reads codes with Apple's own
    // `AVCaptureMetadataOutput` through VisionCamera's core, so zxing-cpp and the frame-processor
    // runtime would be compiled into the iOS app for nothing. `CodeScanner.tsx` never requires
    // either on iOS.
    'react-native-nitro-zxing': { platforms: { ios: null } },
    'react-native-vision-camera-worklets': { platforms: { ios: null } },
  },
};
