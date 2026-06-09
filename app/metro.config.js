// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-fast-tflite carrega modelos .tflite via require() — Metro
// precisa tratá-los como asset binário (ver app/src/services/poseDetector.ts).
config.resolver.assetExts.push('tflite');

module.exports = config;
