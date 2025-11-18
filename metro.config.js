const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// Configuração para suportar SVGs
defaultConfig.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);

// Configuração de extensões de arquivo
defaultConfig.resolver.assetExts = defaultConfig.resolver.assetExts.filter(
  ext => ext !== 'svg'
);
defaultConfig.resolver.sourceExts = [...defaultConfig.resolver.sourceExts, 'svg'];

// Configuração de resolução de módulos para alias
defaultConfig.resolver.alias = {
  ...defaultConfig.resolver.alias,
  '@': path.resolve(__dirname, 'src'),
  '@app': path.resolve(__dirname, 'src/app'),
  '@domain': path.resolve(__dirname, 'src/domain'),
  '@data': path.resolve(__dirname, 'src/data'),
  '@presentation': path.resolve(__dirname, 'src/presentation'),
  '@services': path.resolve(__dirname, 'src/services'),
  '@hooks': path.resolve(__dirname, 'src/hooks'),
  '@utils': path.resolve(__dirname, 'src/utils'),
  '@config': path.resolve(__dirname, 'config'),
  '@assets': path.resolve(__dirname, 'assets'),
  // Shim para react-dom (não existe no React Native, usado pelo Clerk)
  'react-dom': path.resolve(__dirname, 'src/utils/react-dom-shim.js'),
  // Shim para events/EventEmitter (usado pelo Firebase Phone Auth)
  'events': path.resolve(__dirname, 'src/utils/events-shim.js'),
};

// Usar resolveRequest personalizado para garantir que react-dom e events sejam resolvidos corretamente
const originalResolveRequest = defaultConfig.resolver.resolveRequest;
defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-dom') {
    return {
      filePath: path.resolve(__dirname, 'src/utils/react-dom-shim.js'),
      type: 'sourceFile',
    };
  }
  
  // Shim para events/EventEmitter usado pelo Firebase Phone Auth
  if (moduleName === 'events') {
    return {
      filePath: path.resolve(__dirname, 'src/utils/events-shim.js'),
      type: 'sourceFile',
    };
  }
  
  // Usar resolução padrão para outros módulos
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = mergeConfig(defaultConfig, {});
