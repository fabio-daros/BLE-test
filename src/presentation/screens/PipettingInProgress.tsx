// src/presentation/screens/PipettingInProgress.tsx
import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { TemperaturePill } from '@presentation/components';
import Tube from '../../../assets/Vector.svg';
import TubeSelected from '../../../assets/VectorSelected.svg';
import { colors } from '../theme';

type SampleType = 'controle-negativo' | 'controle-positivo' | 'amostra';

export type SampleItem = {
  id: string; // ex: "ID-123"
  type: SampleType; // define o label exibido
  label?: string; // opcional: sobrescreve o rótulo
};

type WellInfo = {
  num: number;
  id: string;
};

type Props = {
  samples: SampleItem[];
  /** Números reais das células selecionadas (ex: [1, 5, 15]) - usado para destacar na grade */
  wellNumbers?: number[];
  /** Informações completas dos poços (número e identificador) */
  wellsInfo?: WellInfo[];
  /** Quantidade de pipes preenchidos (0-16). Define quantos pipes ficam dourados */
  filledPipesCount?: number;
  /** Caso você já tenha um Header padrão, passe aqui (mantém o mesmo visual das outras telas) */
  renderHeader?: React.ReactNode;
  /** Caso você já tenha um Footer (barra dourada), passe aqui para manter o padrão */
  renderFooter?: React.ReactNode;
  /** Mantido sem ação, mas deixei a assinatura pronta */
  onStartPress?: () => void;
  /** Quando quiser animar no futuro: 0..16 marcando quantos poços já "pipetaram" */
  pipettingProgress?: number;
};

// Paleta espelhando SummaryCinomose
const GOLD = '#b8860b';
const GOLD_BG = colors.goldBackground;
const TEXT = colors.textPrimary;
const CARD = colors.white;
const BORDER = colors.borderAlt;
const GRAY_BG = colors.backgroundGray;

const { width: SCREEN_W } = Dimensions.get('window');
const CONTENT_W = Math.min(SCREEN_W * 0.9, 360);
const BOTTOM_GUARD = 110;

const PipettingInProgressScreen: React.FC<Props> = ({
  samples,
  wellNumbers,
  wellsInfo,
  filledPipesCount,
  renderHeader,
  renderFooter,
  onStartPress,
  pipettingProgress = 0,
}) => {
  // Cria um Set com os números das células selecionadas (igual SummaryCinomose)
  const selectedNumbers = useMemo(() => {
    if (wellNumbers && wellNumbers.length > 0) {
      return new Set(wellNumbers);
    }
    // Fallback: se não tiver wellNumbers, usa a quantidade de samples
    return new Set(Array.from({ length: samples.length }, (_, i) => i + 1));
  }, [wellNumbers, samples.length]);

  const items = useMemo(() => {
    // Mantém ordenação por código/id (se contiver número, ordena por ele; senão mantém ordem)
    const parseNum = (s: string) => {
      const m = s.match(/\d+/g);
      return m ? Number(m[m.length - 1]) : Number.POSITIVE_INFINITY;
    };

    // Controles sempre no topo, depois IDs por número
    const ctrlOrder = (t: SampleType) =>
      t === 'controle-negativo' ? 0 : t === 'controle-positivo' ? 1 : 2;

    const sorted = [...samples].sort((a, b) => {
      const byType = ctrlOrder(a.type) - ctrlOrder(b.type);
      if (byType !== 0) return byType;
      return parseNum(a.id) - parseNum(b.id);
    });

    return sorted;
  }, [samples]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Decorações para espelhar a Summary */}
      <View pointerEvents="none" style={styles.decoTop} />
      <View pointerEvents="none" style={styles.decoBottom} />

      {/* Header padrão vindo por props */}
      {renderHeader ?? <FallbackHeader />}

      {/* Pop-up de temperatura como na SummaryCinomose */}
      <TemperaturePill
        initialTempC={31}
        tempLabel="TEMPERATURA DO EQUIPAMENTO"
        tempMessage="O equipamento está sendo aquecido para a execução do teste."
        startExpanded={true}
        initialX={14}
        initialY={58}
        onClose={() => {}}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: BOTTOM_GUARD }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Título */}
            <Text style={styles.title}>Pipetagem em andamento</Text>

            {/* Grade 8x2 com destaque nas células selecionadas */}
            <View
              style={[
                styles.wellsCard,
                { width: 320, minHeight: 120, paddingHorizontal: 16 },
              ]}
            >
              <TubeGrid selectedNumbers={selectedNumbers} />
            </View>

            {/* Lista somente leitura — sem lápis */}
            <View style={styles.listWrap}>
              {items.map((item, idx) => {
                // Usa o número real da célula e identificador se disponível
                const wellInfo = wellsInfo?.[idx];
                const wellNumber =
                  wellInfo?.num ?? wellNumbers?.[idx] ?? idx + 1;
                const identifier = wellInfo?.id ?? item.id;

                return (
                  <View
                    key={`${item.type}-${item.id}-${idx}`}
                    style={styles.listRow}
                  >
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{wellNumber}</Text>
                    </View>
                    <View style={styles.inputWrap}>
                      <Text style={styles.idText} numberOfLines={1}>
                        {identifier}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* CTA para iniciar o teste */}
            <Pressable
              style={styles.cta}
              onPress={onStartPress}
              disabled={false}
            >
              <Text style={styles.ctaText}>Iniciar Teste</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer padrão vindo por props */}
      {renderFooter ?? <FallbackFooter />}
    </SafeAreaView>
  );
};

// (Sem item separado; lista é renderizada inline, somente leitura)

const FallbackHeader = () => <View style={styles.header} />;

const FallbackFooter = () => <View style={styles.footerBar} />;

/** Grade de 16 poços — usando SVGs importados (igual SummaryCinomose) */
const TubeGrid: React.FC<{ selectedNumbers: Set<number> }> = ({
  selectedNumbers,
}) => {
  // Configuração fixa da grade
  const totalWells = 16;
  const columns = 8;
  const rows = 2;

  // Tamanhos configuráveis
  const wellsCardWidth = 320;
  const cardPaddingH = 16;
  const innerW = wellsCardWidth - cardPaddingH * 2;
  const cellHGap = 14;
  const cellVGap = 12;
  const cellWidth = (innerW - cellHGap * (columns - 1)) / columns;
  const tubeSize = { width: 26, height: 50 };

  const numbers = useMemo(
    () => Array.from({ length: totalWells }, (_, i) => i + 1),
    [totalWells]
  );

  return (
    <View style={styles.tubeGridContainer}>
      {Array.from({ length: rows }).map((_, r) => (
        <View
          key={r}
          style={[
            styles.tubeRow,
            { marginBottom: r === rows - 1 ? 0 : cellVGap },
          ]}
        >
          {numbers.slice(r * columns, r * columns + columns).map(n => {
            const isSelected = selectedNumbers.has(n);
            return (
              <View key={n} style={{ width: cellWidth, alignItems: 'center' }}>
                <Text
                  style={[
                    styles.cellNum,
                    isSelected ? styles.cellNumFilled : styles.cellNumEmpty,
                  ]}
                >
                  {n}
                </Text>
                {isSelected ? (
                  <TubeSelected
                    width={tubeSize.width}
                    height={tubeSize.height}
                  />
                ) : (
                  <Tube width={tubeSize.width} height={tubeSize.height} />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrayAlt },
  // Decorações (espelhando Summary)
  decoTop: {
    position: 'absolute',
    top: -36,
    left: -28,
    width: 210,
    height: 110,
    backgroundColor: GRAY_BG,
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
    backgroundColor: GRAY_BG,
    borderRadius: 28,
    transform: [{ rotate: '10deg' }],
    opacity: 0.35,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  content: {
    width: CONTENT_W,
    alignSelf: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },

  // Card da grade (igual Summary)
  wellsCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    marginBottom: 22,
  },
  tubeGridContainer: {
    alignItems: 'center',
  },
  tubeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cellNum: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: '700',
  },
  cellNumFilled: { color: GOLD },
  cellNumEmpty: { color: colors.textMuted },
  // Lista (somente leitura, sem lápis)
  listWrap: {
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  listRow: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: GOLD, fontWeight: '800', fontSize: 12 },
  inputWrap: { flex: 1 },
  idText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.9,
  },

  cta: {
    alignSelf: 'center',
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
  },
  ctaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  footerBar: {
    height: 10,
    backgroundColor: GOLD,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
});

export default memo(PipettingInProgressScreen);
