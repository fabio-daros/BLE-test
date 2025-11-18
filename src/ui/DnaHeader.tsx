// src/ui/DnaHeader.tsx
import React from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import Dna from '@assets/dna.svg';

interface Props {
  /** Deslocamento vertical do conteúdo (logo) para não “colar” no DNA */
  offsetY?: number; // default 260 (igual ao seu)
  /** Multiplicadores de largura/altura do DNA (iguais aos seus) */
  widthMul?: number; // default 2.3
  heightMul?: number; // default 1.3
  /** Posição do DNA em relação ao topo */
  top?: number; // default 0
  /** Estilo opcional do container externo */
  style?: ViewStyle;
  /** Conteúdo central (ex: <Logo .../>) */
  children?: React.ReactNode;
  /** Desligar toques no DNA (padrão: 'none') */
  pointerEvents?: 'auto' | 'none';
}

export const DnaHeader: React.FC<Props> = ({
  offsetY = 260,
  widthMul = 2.3,
  heightMul = 1.3,
  top = 0,
  style,
  children,
  pointerEvents = 'none',
}) => {
  const { width } = Dimensions.get('window');

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.dnaWrap, { top }]} pointerEvents={pointerEvents}>
        <Dna width={width * widthMul} height={width * heightMul} />
      </View>

      <View style={[styles.centerWrap, { marginTop: offsetY }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dnaWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    right: 0,
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DnaHeader;
