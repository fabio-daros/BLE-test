// src/utils/vector-icons-helper.tsx
// Helper centralizado para carregar ícones usando react-native-vector-icons
// Compatível com React Native CLI após migração do Expo

/// <reference path="../types/react-native-vector-icons.d.ts" />

// Importar diretamente as famílias de ícones do react-native-vector-icons
// Os tipos estão declarados em src/types/react-native-vector-icons.d.ts
// @ts-expect-error - Tipos declarados localmente, TypeScript pode não reconhecer imediatamente
import AntDesign from 'react-native-vector-icons/AntDesign';
// @ts-expect-error
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// @ts-expect-error
import Feather from 'react-native-vector-icons/Feather';
// @ts-expect-error
import FontAwesome from 'react-native-vector-icons/FontAwesome';
// @ts-expect-error
import Ionicons from 'react-native-vector-icons/Ionicons';
// @ts-expect-error
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// @ts-expect-error
import Entypo from 'react-native-vector-icons/Entypo';
// @ts-expect-error
import Fontisto from 'react-native-vector-icons/Fontisto';
// @ts-expect-error
import SimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons';
// @ts-expect-error
import Octicons from 'react-native-vector-icons/Octicons';
// @ts-expect-error
import Foundation from 'react-native-vector-icons/Foundation';
// @ts-expect-error
import EvilIcons from 'react-native-vector-icons/EvilIcons';

// Exportar os componentes diretamente
export {
  AntDesign,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
  Ionicons,
  MaterialIcons,
  Entypo,
  Fontisto,
  SimpleLineIcons,
  Octicons,
  Foundation,
  EvilIcons,
};

// Re-exportar tudo como um objeto para compatibilidade
export default {
  AntDesign,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
  Ionicons,
  MaterialIcons,
  Entypo,
  Fontisto,
  SimpleLineIcons,
  Octicons,
  Foundation,
  EvilIcons,
};

