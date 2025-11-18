// src/presentation/screens/TestHistory.tsx
import React, { memo, useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { AntDesign } from '@/utils/vector-icons-helper';
import { testDataService, TestHistoryItem } from '@/data/test-data-service';
import { colors } from '@presentation/theme';

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  operatorName?: string; // "Vet. Luíza"
  // eslint-disable-next-line no-unused-vars
  onOpenResult?: (item: TestHistoryItem) => void;
}

const BOTTOM_GUARD = 96;

const TestHistory: React.FC<Props> = ({
  onBack,
  onGoHome,
  operatorName,
  onOpenResult,
}) => {
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTestHistory = useCallback(() => {
    try {
      setLoading(true);

      // Se há um operador específico, filtra por ele, senão carrega todos
      const data = operatorName
        ? testDataService.getTestsByOperator(operatorName)
        : testDataService.getAllTestHistory();

      setTestHistory(data);
    } catch (error) {
      console.error('Erro ao carregar histórico de testes:', error);
      setTestHistory([]);
    } finally {
      setLoading(false);
    }
  }, [operatorName]);

  useEffect(() => {
    loadTestHistory();
  }, [operatorName, loadTestHistory]);

  const isEmpty = !testHistory || testHistory.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* decorações suaves */}
      <View pointerEvents="none" style={styles.decoTop} />
      <View pointerEvents="none" style={styles.decoBottom} />

      <AppHeader
        {...(onBack && { onBack })}
        {...(onGoHome && { onGoHome })}
        showHistoryButton={false}
      />

      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>Histórico de Testes</Text>
        <View style={styles.titleUnderline} />
        {!!operatorName && !isEmpty && (
          <View style={styles.operatorChip}>
            <Text style={styles.operatorText}>Operador: {operatorName}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <LoadingState />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <FlatList
          data={testHistory}
          keyExtractor={it => it.id}
          contentContainerStyle={{ paddingBottom: BOTTOM_GUARD }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => (
            <HistoryRow
              index={index + 1}
              item={item}
              onPressResult={() => onOpenResult?.(item)}
            />
          )}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadTestHistory}
        />
      )}

      <BottomBar fixed />
    </SafeAreaView>
  );
};

const LoadingState = memo(function LoadingState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <AntDesign name="loading1" size={28} color={colors.gold} />
      </View>
      <Text style={styles.emptyTitle}>Carregando...</Text>
      <Text style={styles.emptyDesc}>Buscando histórico de testes...</Text>
    </View>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <AntDesign name="exclamationcircleo" size={28} color={colors.gold} />
      </View>
      <Text style={styles.emptyTitle}>Sem Registros</Text>
      <Text style={styles.emptyDesc}>
        Não há registros de testes realizados neste dispositivo.
      </Text>
    </View>
  );
});

const HistoryRow = memo(function HistoryRow({
  index,
  item,
  onPressResult,
}: {
  index: number;
  item: TestHistoryItem;
  onPressResult?: () => void;
}) {
  const getResultColor = (result: string) => {
    return result === 'Positivo' ? colors.errorAlt2 : colors.successAlt;
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index}</Text>
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={styles.rowTitle}>{item.testLabel}</Text>
          <Text style={styles.rowSubtitle}>{formatWhen(item.timestamp)}</Text>
          <Text style={styles.rowAnimal}>
            {item.animalName} ({item.animalSpecies})
          </Text>
          <Text style={styles.rowOperator}>Operador: {item.operator}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <View
          style={[
            styles.resultBadge,
            { backgroundColor: getResultColor(item.result) + '15' },
          ]}
        >
          <Text
            style={[
              styles.resultBadgeText,
              { color: getResultColor(item.result) },
            ]}
          >
            {item.result}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPressResult}
          style={styles.resultBtn}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Abrir resultado"
        >
          <Text style={styles.resultText}>VER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

function formatWhen(ts: string) {
  // Aceita ISO ou string já formatada; se for ISO, formata dd/MM/yyyy - HH:mm
  const isoMatch = /^\d{4}-\d{2}-\d{2}T/.test(ts);
  if (!isoMatch) return ts;
  const d = new Date(ts);
  const d2 = String(d.getDate()).padStart(2, '0');
  const m2 = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d2}/${m2}/${y} - ${hh}:${mm}`;
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

  headerTitleWrap: {
    paddingTop: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    opacity: 0.9,
  },
  titleUnderline: {
    width: 44,
    height: 3,
    backgroundColor: colors.gold,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 12,
  },
  operatorChip: {
    backgroundColor: colors.goldBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginTop: 4,
  },
  operatorText: {
    color: colors.textPrimary,
    fontWeight: '600',
    opacity: 0.85,
  },

  list: { paddingHorizontal: 18, marginTop: 8 },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: BOTTOM_GUARD,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: colors.white,
  },
  emptyTitle: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
  },
  emptyDesc: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },

  // Row
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: colors.shadowColor,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.gold, fontWeight: '800', fontSize: 12 },
  rowTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16 },
  rowSubtitle: { color: colors.textMuted, fontSize: 12 },
  rowAnimal: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  rowOperator: { color: colors.textMuted, fontSize: 11 },

  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resultBadgeText: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },

  resultBtn: {
    backgroundColor: colors.goldBackground,
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  resultText: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
  },
});

export default TestHistory;
