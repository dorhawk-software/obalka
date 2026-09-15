module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // pdf.js (010 US3) ships `static { … }` class blocks even in its `legacy` build, and RN's preset
    // does not transform them — Metro fails the WHOLE bundle with "Static class blocks are not
    // enabled", not just that module. Caught on the device, where it presented as a feature that
    // silently did nothing while the app ran an older cached bundle.
    '@babel/plugin-transform-class-static-block',
    // Reanimated 4 worklets transform — MUST be listed last. (In v4 the plugin moved from
    // react-native-reanimated/plugin to react-native-worklets/plugin.)
    'react-native-worklets/plugin',
  ],
};
