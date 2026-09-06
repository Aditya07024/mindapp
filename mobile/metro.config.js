const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Override the module resolver to force zustand to load the CommonJS version.
// This prevents Expo Web from throwing "Cannot use 'import.meta' outside a module"
// because the ESM version of zustand uses import.meta.env internally.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('zustand')) {
    return {
      filePath: require.resolve(moduleName),
      type: 'sourceFile',
    };
  }
  
  // Chain to the standard Metro resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
