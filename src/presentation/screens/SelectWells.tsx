import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { AppHeader, TemperaturePill } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { colors } from '@presentation/theme';

// ⚠️ Ajuste o caminho conforme sua estrutura
import Tube from '../../../assets/Vector.svg';
import TubeSelected from '../../../assets/VectorSelected.svg';

interface TubeSize {
  width: number;
  height: number;
}

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;

  title?: string;
  subtitle?: string;

  totalWells?: number; // default 16
  columns?: number; // default 4 (mantém 4 por linha)
  initiallySelected?: number[];

  onConfirm?: (selected: number[]) => void;

  // Pop-up de temperatura
  initialTempC?: number;
  tempLabel?: string;
  tempMessage?: string | null;
  startExpandedPill?: boolean;

  // ⭐ Novo: controles fáceis de layout do card/grade
  wellsCardWidth?: number; // default 240 (mais estreito)
  wellsCardMinHeight?: number; // default 360 (mais alto)
  tubeSize?: TubeSize; // default { width: 26, height: 50 }
  cellVGap?: number; // default 12
  cellHGap?: number; // default 14
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOTTOM_GUARD = 110;
const CONTENT_W = Math.min(SCREEN_W * 0.9, 360);

const SelectWells: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
  title = 'Cinomose',
  subtitle = 'Selecione a quantidade de amostras que serão utilizadas no teste.',
  totalWells = 16,
  columns = 4,
  initiallySelected = [],
  onConfirm,

  initialTempC = 31,
  tempLabel = 'TEMPERATURA DO EQUIPAMENTO',
  tempMessage = null,
  startExpandedPill = true,

  // Defaults do novo layout
  wellsCardWidth = 240,
  wellsCardMinHeight = 360,
  tubeSize = { width: 26, height: 50 },
  cellVGap = 12,
  cellHGap = 14,
}) => {
  // ---- Seleção dos poços
  const [selected, setSelected] = useState<number[]>(initiallySelected);
  const canConfirm = selected.length > 0;
  const rows = Math.ceil(totalWells / columns);
  const numbers = Array.from({ length: totalWells }, (_, i) => i + 1);

  const toggleWell = (n: number) => {
    setSelected(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    );
  };

  // ---- Pop-up de temperatura removido - agora usando componente TemperaturePill

  // ---- Cálculo conveniente do tamanho da célula
  const cardPaddingH = 16; // padding horizontal interno do card
  const innerW = wellsCardWidth - cardPaddingH * 2;
  const cellWidth = (innerW - cellHGap * (columns - 1)) / columns;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Decorações */}
      <View pointerEvents="none" style={styles.decoTop} />
      <View pointerEvents="none" style={styles.decoBottom} />

      <AppHeader
        {...(onBack && { onBack })}
        {...(onGoHome && { onGoHome })}
        {...(onOpenHistory && { onOpenHistory })}
      />

      {/* Pop-up de temperatura usando componente TemperaturePill */}
      <TemperaturePill
        initialTempC={initialTempC}
        tempLabel={tempLabel}
        tempMessage={tempMessage}
        startExpanded={startExpandedPill}
        initialX={14}
        initialY={58}
        onClose={() => {
          // Callback opcional se necessário
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: BOTTOM_GUARD }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Título/subtítulo */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Card mais estreito e alto */}
          <View
            style={[
              styles.wellsCard,
              {
                width: wellsCardWidth,
                minHeight: wellsCardMinHeight,
                paddingHorizontal: cardPaddingH,
              },
            ]}
          >
            {/* Render da grade 4x4 */}
            {Array.from({ length: rows }).map((_, r) => (
              <View
                key={r}
                style={[
                  styles.row,
                  { marginBottom: r === rows - 1 ? 0 : cellVGap },
                ]}
              >
                {numbers
                  .slice(r * columns, r * columns + columns)
                  .map((n, i) => (
                    <View key={n} style={{ width: cellWidth }}>
                      <WellCell
                        num={n}
                        selected={selected.includes(n)}
                        onPress={() => toggleWell(n)}
                        tubeSize={tubeSize}
                      />
                    </View>
                  ))}
              </View>
            ))}
          </View>

          {/* CTA Confirmar */}
          <TouchableOpacity
            style={[styles.cta, !canConfirm && styles.ctaDisabled]}
            activeOpacity={canConfirm ? 0.9 : 1}
            disabled={!canConfirm}
            onPress={() => onConfirm?.(selected.slice().sort((a, b) => a - b))}
          >
            <Text
              style={[styles.ctaText, !canConfirm && styles.ctaTextDisabled]}
            >
              Confirmar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomBar fixed />
    </SafeAreaView>
  );
};

function WellCell({
  num,
  selected,
  onPress,
  tubeSize,
}: {
  num: number;
  selected: boolean;
  onPress: () => void;
  tubeSize: TubeSize;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.cellWrap}
      accessibilityRole="button"
      accessibilityLabel={`Poço ${num}${selected ? ' selecionado' : ''}`}
    >
      <Text style={[styles.cellNum, selected && styles.cellNumSelected]}>
        {num}
      </Text>
      {selected ? (
        <TubeSelected width={tubeSize.width} height={tubeSize.height} />
      ) : (
        <Tube width={tubeSize.width} height={tubeSize.height} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrayAlt },

  decoTop: {
    position: 'absolute',
    top: -36,
    left: -28,
    width: 210,
    height: 110,
    backgroundColor: colors.backgroundGray,
    borderRadius: 28,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.5,
  },
  decoBottom: {
    position: 'absolute',
    bottom: -24,
    right: -36,
    width: 220,
    height: 110,
    backgroundColor: colors.backgroundGray,
    borderRadius: 28,
    transform: [{ rotate: '10deg' }],
    opacity: 0.35,
  },

  content: {
    width: CONTENT_W,
    alignSelf: 'center',
    alignItems: 'center',
  },

  // Estilos do pop-up removidos - agora usando componente TemperaturePill

  // Título/subtítulo
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },

  // Card mais estreito e alto
  wellsCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    paddingVertical: 14,
    marginBottom: 80,
    marginTop: 40,
  },

  // Grade
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Célula
  cellWrap: {
    alignItems: 'center',
  },
  cellNum: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: '700',
  },
  cellNumSelected: { color: colors.gold },

  // CTA
  cta: {
    alignSelf: 'center',
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: colors.disabled },
  ctaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  ctaTextDisabled: { color: colors.textMutedAlt7 },
});

export default SelectWells;
