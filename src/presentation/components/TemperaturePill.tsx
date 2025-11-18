import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  PanResponderInstance,
  Dimensions,
} from 'react-native';
import { AntDesign, MaterialCommunityIcons } from '@/utils/vector-icons-helper';
import { colors } from '@presentation/theme';

interface TemperaturePillProps {
  /** Temperatura inicial em Celsius */
  initialTempC?: number;
  /** Label da temperatura */
  tempLabel?: string;
  /** Mensagem adicional (opcional) */
  tempMessage?: string | null;
  /** Se o pop-up começa expandido */
  startExpanded?: boolean;
  /** Callback quando o pop-up é fechado */
  onClose?: () => void;
  /** Posição inicial X */
  initialX?: number;
  /** Posição inicial Y */
  initialY?: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOTTOM_GUARD = 110;

export const TemperaturePill: React.FC<TemperaturePillProps> = ({
  initialTempC = 31,
  tempLabel = 'TEMPERATURA DO EQUIPAMENTO',
  tempMessage = null,
  startExpanded = true,
  onClose,
  initialX = 14,
  initialY = 58,
}) => {
  // Estados do pop-up
  const [pillExpanded, setPillExpanded] = useState<boolean>(startExpanded);
  const [pillVisible, setPillVisible] = useState<boolean>(true);
  const [pillMinimized, setPillMinimized] = useState<boolean>(false);

  // Dimensões dos estados
  const pillWExpanded = 260;
  const pillHExpanded = tempMessage ? 74 : 50;
  const pillWCompact = 40;
  const pillHCompact = 40;
  const pillWMinimized = 32;
  const pillHMinimized = 32;

  // Posição e controle de drag
  const pos = useRef({ x: initialX, y: initialY });
  const startPos = useRef({ x: initialX, y: initialY });
  const [, force] = useState({});

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const panResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt, gestureState) => {
          return true;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10
          );
        },
        onPanResponderGrant: () => {
          startPos.current = { x: pos.current.x, y: pos.current.y };
        },
        onPanResponderMove: (_, g) => {
          let w, h;
          if (pillMinimized) {
            w = pillWMinimized;
            h = pillHMinimized;
          } else if (pillExpanded) {
            w = pillWExpanded;
            h = pillHExpanded;
          } else {
            w = pillWCompact;
            h = pillHCompact;
          }

          pos.current = {
            x: clamp(startPos.current.x + g.dx, 8, SCREEN_W - w - 8),
            y: clamp(
              startPos.current.y + g.dy,
              8,
              SCREEN_H - h - 8 - BOTTOM_GUARD
            ),
          };
          force({});
        },
        onPanResponderRelease: () => {},
        onPanResponderTerminate: () => {},
      }),
    [pillExpanded, pillMinimized]
  );

  // Funções de controle
  const closePill = () => {
    setPillVisible(false);
    onClose?.();
  };

  const minimizePill = () => {
    setPillMinimized(true);
    setPillExpanded(false);
  };

  const maximizePill = () => {
    setPillMinimized(false);
    setPillExpanded(true);
  };

  const togglePill = () => {
    if (pillMinimized) {
      maximizePill();
    } else {
      setPillExpanded(v => !v);
    }
  };

  if (!pillVisible) {
    return null;
  }

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.pill,
        pillMinimized
          ? styles.pillMinimized
          : pillExpanded
            ? styles.pillExpanded
            : styles.pillCompact,
        {
          transform: [
            { translateX: pos.current.x },
            { translateY: pos.current.y },
          ],
        },
      ]}
    >
      {pillMinimized ? (
        // Estado minimizado - quadrado pequeno com ícone
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={maximizePill}
          style={styles.pillMinimizedContent}
        >
          <MaterialCommunityIcons
            name="thermometer"
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      ) : (
        // Estados expandido e compacto
        <>
          {pillExpanded ? (
            // Estado expandido - apenas conteúdo informativo (sem toque)
            <View style={styles.pillTap}>
              <View style={styles.pillRow}>
                <MaterialCommunityIcons
                  name="thermometer"
                  size={16}
                  color={colors.textMuted}
                />
                <Text style={styles.pillLabel} numberOfLines={1}>
                  {tempLabel}
                </Text>
                <View style={styles.tempChip}>
                  <Text style={styles.tempChipText}>{`${initialTempC}°C`}</Text>
                </View>
              </View>
              {!!tempMessage && (
                <Text style={styles.pillMsg}>{tempMessage}</Text>
              )}
            </View>
          ) : (
            // Estado compacto - toque alterna para expandido
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={togglePill}
              style={styles.pillTap}
            >
              <MaterialCommunityIcons
                name="thermometer"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={pillExpanded ? minimizePill : closePill}
            style={styles.pillClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AntDesign
              name={pillExpanded ? 'minus' : 'close'}
              size={12}
              color={colors.textMutedAlt5}
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    zIndex: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    padding: 8,
    shadowColor: colors.shadowColor,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillExpanded: { width: 260, minHeight: 50 },
  pillCompact: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillMinimized: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillMinimizedContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTap: { paddingRight: 22 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  tempChip: {
    backgroundColor: colors.goldBackground,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  tempChipText: { color: colors.textPrimary, fontWeight: '800', fontSize: 12 },
  pillMsg: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  pillClose: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundGrayAlt2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.disabledAlt2,
  },
});

export default TemperaturePill;
