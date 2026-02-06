const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force react-native-wagmi-charts to use compiled lib so Metro doesn't fail on ./types from src
const wagmiChartsLib = path.resolve(
  __dirname,
  'node_modules/react-native-wagmi-charts/lib/commonjs/index.js'
);
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-wagmi-charts') {
    return { type: 'sourceFile', filePath: wagmiChartsLib };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
