// src/utils/vector-icons-helper.tsx
// Helper centralizado para carregar ícones do @expo/vector-icons
// Resolve problemas de importação no React Native CLI

import React from 'react';
import { Text } from 'react-native';

// Função para carregar um componente de ícone
function loadIconComponent(iconName: string, fallbackEmoji: string) {
  try {
    // @ts-ignore
    const iconsModule = require('@expo/vector-icons');
    
    // Tentar diferentes formas de acessar o componente
    const IconComponent = iconsModule[iconName] || 
                         iconsModule.default?.[iconName] ||
                         (iconsModule.default && iconsModule.default[iconName]);
    
    if (IconComponent && typeof IconComponent === 'function') {
      return IconComponent;
    }
    
    console.warn(`${iconName} não encontrado em @expo/vector-icons, usando fallback`);
    // Fallback: componente simples com emoji
    return ({ name, size, color, ...props }: any) => (
      <Text style={{ fontSize: size || 20, color: color || '#000' }} {...props}>
        {fallbackEmoji}
      </Text>
    );
  } catch (error: any) {
    // Capturar erros específicos do EventEmitter ou outros
    if (error?.message?.includes('EventEmitter') || error?.message?.includes('Cannot read property')) {
      console.warn(`Erro ao carregar ${iconName} (provável problema com EventEmitter), usando fallback`);
    } else {
      console.error(`Erro ao carregar ${iconName} de @expo/vector-icons:`, error);
    }
    // Fallback mínimo para evitar crash
    return ({ name, size, color, ...props }: any) => (
      <Text style={{ fontSize: size || 20, color: color || '#000' }} {...props}>
        {fallbackEmoji}
      </Text>
    );
  }
}

// Carregar todos os ícones comumente usados
export const AntDesign = loadIconComponent('AntDesign', '🔍');
export const MaterialCommunityIcons = loadIconComponent('MaterialCommunityIcons', '📱');
export const Feather = loadIconComponent('Feather', '✨');
export const FontAwesome = loadIconComponent('FontAwesome', '⭐');

// Re-exportar tudo como um objeto para compatibilidade
export default {
  AntDesign,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
};

