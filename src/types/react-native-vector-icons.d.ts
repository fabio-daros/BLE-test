// Declarações de tipos para react-native-vector-icons
// Como o pacote não tem tipos oficiais, criamos declarações locais

import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  [key: string]: any;
}

// Declaração de módulo para cada família de ícones
declare module 'react-native-vector-icons/AntDesign' {
  const AntDesign: React.ComponentType<IconProps>;
  export default AntDesign;
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  const MaterialCommunityIcons: React.ComponentType<IconProps>;
  export default MaterialCommunityIcons;
}

declare module 'react-native-vector-icons/Feather' {
  const Feather: React.ComponentType<IconProps>;
  export default Feather;
}

declare module 'react-native-vector-icons/FontAwesome' {
  const FontAwesome: React.ComponentType<IconProps>;
  export default FontAwesome;
}

declare module 'react-native-vector-icons/Ionicons' {
  const Ionicons: React.ComponentType<IconProps>;
  export default Ionicons;
}

declare module 'react-native-vector-icons/MaterialIcons' {
  const MaterialIcons: React.ComponentType<IconProps>;
  export default MaterialIcons;
}

declare module 'react-native-vector-icons/Entypo' {
  const Entypo: React.ComponentType<IconProps>;
  export default Entypo;
}

declare module 'react-native-vector-icons/Fontisto' {
  const Fontisto: React.ComponentType<IconProps>;
  export default Fontisto;
}

declare module 'react-native-vector-icons/SimpleLineIcons' {
  const SimpleLineIcons: React.ComponentType<IconProps>;
  export default SimpleLineIcons;
}

declare module 'react-native-vector-icons/Octicons' {
  const Octicons: React.ComponentType<IconProps>;
  export default Octicons;
}

declare module 'react-native-vector-icons/Foundation' {
  const Foundation: React.ComponentType<IconProps>;
  export default Foundation;
}

declare module 'react-native-vector-icons/EvilIcons' {
  const EvilIcons: React.ComponentType<IconProps>;
  export default EvilIcons;
}
