module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@app': './src/app',
          '@domain': './src/domain',
          '@data': './src/data',
          '@presentation': './src/presentation',
          '@services': './src/services',
          '@types': './src/types',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@config': './config',
          '@assets': './assets',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
