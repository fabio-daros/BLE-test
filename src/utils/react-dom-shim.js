// Shim para react-dom no React Native
// Clerk usa react-dom internamente, mas não é necessário em React Native
// Este shim fornece APIs vazias/placeholders para evitar erros de importação

module.exports = {
  // APIs básicas que podem ser chamadas
  render: () => {},
  hydrate: () => {},
  createPortal: (children, container) => children,
  flushSync: (fn) => fn(),
  findDOMNode: () => null,
  unmountComponentAtNode: () => false,
  // Versão (pode ser acessada por algumas libs)
  version: '18.0.0',
  // Hooks que podem ser usados
  useInsertionEffect: () => {},
  useId: () => 'react-native-id',
};
