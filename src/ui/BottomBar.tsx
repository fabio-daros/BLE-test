// src/ui/BottomBar.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '@/ui/tokens';

interface Props {
  style?: ViewStyle;
  height?: number;
  borderRadius?: number;
  /** Se a barra deve ficar fixa na parte inferior da tela */
  fixed?: boolean;
}

export const BottomBar: React.FC<Props> = ({
  style,
  height = 16,
  borderRadius = 6,
  fixed = true,
}) => {
  return (
    <View
      style={[
        styles.base,
        fixed && styles.fixed,
        {
          height,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    width: '200%',
    backgroundColor: COLORS.gold,
  },
  fixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default BottomBar;
