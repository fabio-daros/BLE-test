// src/presentation/screens/SummaryCinomose.tsx
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppHeader, TemperaturePill } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { AntDesign } from '@/utils/vector-icons-helper';
import { colors } from '@presentation/theme';

import Tube from '../../../assets/Vector.svg';
import TubeSelected from '../../../assets/VectorSelected.svg';

type WellSummary = { num: number; id: string };

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;

  /** Título do teste (padrão: "Cinomose") */
  title?: string;

  /** Poços selecionados vindo da tela anterior */
  wells: WellSummary[];

  /** Configuração fixa da grade de poços */
  // totalWells: sempre 16
  // columns: sempre 8
  // rows: sempre 2
  // Layout fixo: 8x2 (8 poços por linha, 2 linhas)

  /** Tamanhos/estilo facilmente ajustáveis */
  wellsCardWidth?: number; // 240
  wellsCardMinHeight?: number; // 360
  tubeSize?: { width: number; height: number }; // {26, 50}
  cellVGap?: number; // 12
  cellHGap?: number; // 14

  /** (Opcional) Ação ao confirmar — por ora não faremos nada */
  onConfirm?: (wells: WellSummary[]) => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CONTENT_W = Math.min(SCREEN_W * 0.9, 360);
const BOTTOM_GUARD = 110;

const SummaryCinomose: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
  title = 'Cinomose',
  wells,
  wellsCardWidth = 320,
  wellsCardMinHeight = 120,
  tubeSize = { width: 26, height: 50 },
  cellVGap = 12,
  cellHGap = 14,
  onConfirm,
}) => {
  // Configuração fixa da grade
  const totalWells = 16;
  const columns = 8;
  const rows = 2;
  // estado local editável dos IDs
  const [items, setItems] = useState<WellSummary[]>(
    wells.slice().sort((a, b) => a.num - b.num)
  );
  const [editing, setEditing] = useState<Record<number, boolean>>({});

  const selectedNumbers = useMemo(
    () => new Set(items.map(w => w.num)),
    [items]
  );

  const numbers = useMemo(
    () => Array.from({ length: totalWells }, (_, i) => i + 1),
    [totalWells]
  );

  const cardPaddingH = 16;
  const innerW = wellsCardWidth - cardPaddingH * 2;
  const cellWidth = (innerW - cellHGap * (columns - 1)) / columns;

  const startEdit = (num: number) => setEditing(e => ({ ...e, [num]: true }));

  const endEdit = (num: number) => setEditing(e => ({ ...e, [num]: false }));

  const updateId = (num: number, text: string) => {
    setItems(prev => prev.map(w => (w.num === num ? { ...w, id: text } : w)));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* decorativos */}
      <View pointerEvents="none" style={styles.decoTop} />
      <View pointerEvents="none" style={styles.decoBottom} />

      <AppHeader
        {...(onBack && { onBack })}
        {...(onGoHome && { onGoHome })}
        {...(onOpenHistory && { onOpenHistory })}
      />

      {/* Pop-up de temperatura usando componente TemperaturePill */}
      <TemperaturePill
        initialTempC={31}
        tempLabel="TEMPERATURA DO EQUIPAMENTO"
        tempMessage="O equipamento está sendo aquecido para a execução do teste."
        startExpanded={true}
        initialX={14}
        initialY={58}
        onClose={() => {
          // Callback opcional se necessário
        }}
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
            {/* Título/subtítulo */}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              Antes de começar, confirme os identificadores de cada amostra.
            </Text>

            {/* Grade visual com todos os poços (destacando os selecionados) */}
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
              {Array.from({ length: rows }).map((_, r) => (
                <View
                  key={r}
                  style={[
                    styles.row,
                    { marginBottom: r === rows - 1 ? 0 : cellVGap },
                  ]}
                >
                  {numbers.slice(r * columns, r * columns + columns).map(n => (
                    <View
                      key={n}
                      style={{ width: cellWidth, alignItems: 'center' }}
                    >
                      <Text
                        style={[
                          styles.cellNum,
                          selectedNumbers.has(n) && styles.cellNumSelected,
                        ]}
                      >
                        {n}
                      </Text>
                      {selectedNumbers.has(n) ? (
                        <TubeSelected
                          width={tubeSize.width}
                          height={tubeSize.height}
                        />
                      ) : (
                        <Tube width={tubeSize.width} height={tubeSize.height} />
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* Lista de IDs editáveis (apenas dos selecionados) */}
            <View style={styles.listWrap}>
              {items.map(w => {
                const isEditing = !!editing[w.num];
                return (
                  <View key={w.num} style={styles.listRow}>
                    {/* badge com número do poço */}
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{w.num}</Text>
                    </View>

                    {/* campo (texto ou input) */}
                    <View style={styles.inputWrap}>
                      {isEditing ? (
                        <TextInput
                          value={w.id}
                          onChangeText={t => updateId(w.num, t)}
                          onBlur={() => endEdit(w.num)}
                          autoFocus
                          style={styles.input}
                          placeholder="ID da amostra"
                          placeholderTextColor={colors.textMutedAlt6}
                          returnKeyType="done"
                        />
                      ) : (
                        <Text style={styles.idText}>{w.id}</Text>
                      )}
                    </View>

                    {/* botão lápis */}
                    {!isEditing && (
                      <TouchableOpacity
                        onPress={() => startEdit(w.num)}
                        style={styles.pencilBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <AntDesign name="edit" size={16} color={colors.gold} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            {/* CTA Confirmar (ativo sempre; por ora sem ação) */}
            <TouchableOpacity
              style={styles.cta}
              activeOpacity={0.9}
              onPress={() => onConfirm?.(items)}
            >
              <Text style={styles.ctaText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomBar fixed />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrayAlt },

  // Decorações
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

  // Card da grade
  wellsCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    paddingVertical: 14,
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cellNum: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: '700',
  },
  cellNumSelected: { color: colors.gold },

  // Lista de IDs
  listWrap: {
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  listRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderAlt,
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
    backgroundColor: colors.goldBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.gold, fontWeight: '800', fontSize: 12 },

  inputWrap: {
    flex: 1,
  },
  idText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.9,
  },
  input: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderGoldAlt,
  },
  pencilBtn: {
    padding: 4,
    borderRadius: 8,
  },

  // CTA
  cta: {
    alignSelf: 'center',
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  ctaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

export default SummaryCinomose;
