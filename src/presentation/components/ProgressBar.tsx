import React from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { COLORS, SP } from '@/ui/tokens';

interface ProgressBarProps {
  /** Largura da barra em porcentagem (padrão: 70%) */
  width?: DimensionValue;
  /** Altura da barra em pixels (padrão: 6px) */
  height?: number;
  /** Raio da borda em pixels (padrão: 3px) */
  borderRadius?: number;
  /** Margem superior em pixels (padrão: 16px) */
  marginTop?: number;
  /** Estilo customizado para o container */
  style?: ViewStyle;
  /** Estilo customizado para a trilha */
  trackStyle?: ViewStyle;
  /** Estilo customizado para o indicador */
  thumbStyle?: ViewStyle;
  /** Cor da trilha (padrão: progressTrack) */
  trackColor?: string;
  /** Cor do indicador (padrão: progressThumb) */
  thumbColor?: string;
  /** Largura do indicador em porcentagem (padrão: 25%) */
  thumbWidth?: DimensionValue;
}

/**
 * Componente de barra de progresso decorativa
 *
 * Usado como elemento visual decorativo no rodapé das telas,
 * mantendo consistência visual em todo o aplicativo.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  width = '70%',
  height = 6,
  borderRadius = 3,
  marginTop = SP.sm,
  style,
  trackStyle,
  thumbStyle,
  trackColor = COLORS.progressTrack,
  thumbColor = COLORS.progressThumb,
  thumbWidth = '25%',
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          width,
          marginTop,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.track,
          {
            height,
            backgroundColor: trackColor,
            borderRadius,
          },
          trackStyle,
        ]}
      >
        <View
          style={[
            styles.thumb,
            {
              height,
              width: thumbWidth,
              backgroundColor: thumbColor,
              borderRadius,
            },
            thumbStyle,
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  thumb: {
    // O thumb fica dentro da track
  },
});

export default ProgressBar;
