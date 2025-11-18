// src/presentation/screens/ResultsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import ShareDefault from '@assets/ShareDefault.svg';
import DownloadDefault from '@assets/DownloadDefault.svg';
import { colors } from '@presentation/theme';

// ====== Tipos
export type ResultadoStatus = 'Positiva' | 'Negativa' | 'Inconclusiva';

export type AmostraResultado = {
  id: string | number; // usado na ordenação
  titulo: string; // “Amostra 1”
  subtitulo: string; // “Controle Negativo” ou “ID-123”
  status: ResultadoStatus; // “Positiva” | “Negativa” | “Inconclusiva”
};

export type ResultsScreenProps = {
  // Hook assíncrono para carregar os resultados
  loadResults?: () => Promise<AmostraResultado[]>;
  // Ações do header
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;
  // CTA inferior
  onConcluir?: () => void;
};

// ====== Utils
function formatDateBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function numericKey(v: string | number) {
  if (typeof v === 'number') return v;
  const num = parseInt(String(v).replace(/\D+/g, ''), 10);
  if (!Number.isNaN(num)) return num;
  return Number.MAX_SAFE_INTEGER; // strings sem dígitos vão ao final
}
function statusColor(s: ResultadoStatus) {
  if (s === 'Positiva') return colors.successAlt;
  if (s === 'Negativa') return colors.errorAlt;
  return colors.warningAlt;
}

// ====== Item da lista
const AmostraRow = ({
  index,
  item,
}: {
  index: number;
  item: AmostraResultado;
}) => {
  return (
    <View style={styles.rowWrap} accessible accessibilityRole="text">
      {/* Bolinha com índice (1..N) */}
      <View style={styles.indexBadge}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>

      {/* Título e subtítulo */}
      <View style={styles.rowTexts}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.titulo}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.subtitulo}
        </Text>
      </View>

      {/* Status colorido */}
      <Text
        style={[styles.rowStatus, { color: statusColor(item.status) }]}
        numberOfLines={1}
      >
        {item.status}
      </Text>
    </View>
  );
};

// ====== Tela
const ResultsScreen: React.FC<ResultsScreenProps> = ({
  loadResults,
  onBack,
  onGoHome,
  onOpenHistory,
  onConcluir,
}) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AmostraResultado[]>([]);
  const [openedAt] = useState(() => new Date());

  // Carrega resultados (hook/async). Se não houver, usa mock.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        const data = (await loadResults?.()) ??
          // MOCK (somente para visualização de front)
          [
            {
              id: 1,
              titulo: 'Amostra 1',
              subtitulo: 'Controle Negativo',
              status: 'Negativa',
            },
            {
              id: 2,
              titulo: 'Amostra 2',
              subtitulo: 'Controle Positivo',
              status: 'Positiva',
            },
            {
              id: 3,
              titulo: 'Amostra 3',
              subtitulo: 'ID-123',
              status: 'Positiva',
            },
            {
              id: 4,
              titulo: 'Amostra 4',
              subtitulo: 'ID-234',
              status: 'Negativa',
            },
            {
              id: 5,
              titulo: 'Amostra 5',
              subtitulo: 'ID-345',
              status: 'Positiva',
            },
            {
              id: 6,
              titulo: 'Amostra 6',
              subtitulo: 'ID-456',
              status: 'Positiva',
            },
            {
              id: 8,
              titulo: 'Amostra 8',
              subtitulo: 'ID-567',
              status: 'Positiva',
            },
            {
              id: 9,
              titulo: 'Amostra 9',
              subtitulo: 'ID-567',
              status: 'Negativa',
            },
            {
              id: 10,
              titulo: 'Amostra 10',
              subtitulo: 'ID-567',
              status: 'Negativa',
            },
            {
              id: 11,
              titulo: 'Amostra 11',
              subtitulo: 'ID-567',
              status: 'Positiva',
            },
            {
              id: 12,
              titulo: 'Amostra 12',
              subtitulo: 'ID-567',
              status: 'Negativa',
            },
            {
              id: 13,
              titulo: 'Amostra 13',
              subtitulo: 'ID-567',
              status: 'Inconclusiva',
            },
            {
              id: 14,
              titulo: 'Amostra 14',
              subtitulo: 'ID-567',
              status: 'Inconclusiva',
            },
            {
              id: 15,
              titulo: 'Amostra 15',
              subtitulo: 'ID-567',
              status: 'Inconclusiva',
            },
            {
              id: 16,
              titulo: 'Amostra 16',
              subtitulo: 'ID-567',
              status: 'Negativa',
            },
          ];
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loadResults]);

  // Ordenação por código/id
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const na = numericKey(a.id);
        const nb = numericKey(b.id);
        if (na !== nb) return na - nb;
        return String(a.id).localeCompare(String(b.id));
      }),
    [items]
  );

  const testDate = formatDateBR(openedAt);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header padrão */}
      <AppHeader
        {...(onBack && { onBack })}
        {...(onGoHome && { onGoHome })}
        {...(onOpenHistory && { onOpenHistory })}
      />

      {/* Título "Resultado" */}
      <View style={styles.headerArea}>
        <View>
          <Text style={styles.title}>Resultado</Text>
          <View style={styles.titleLine} />
        </View>

        {/* Ações (apenas UI, sem lógica por enquanto) */}
        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar resultados"
            onPress={() => {}}
          >
            <ShareDefault width={20} height={20} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Baixar resultados"
            onPress={() => {}}
          >
            <DownloadDefault width={20} height={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Seção "Amostras" + Data */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Amostras</Text>
        <Text style={styles.sectionDate}>{testDate}</Text>
      </View>

      {/* Lista */}
      <View style={styles.listCard}>
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={it => String(it.id)}
            renderItem={({ item, index }) => (
              <AmostraRow index={index} item={item} />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingVertical: 6 }}
            showsVerticalScrollIndicator={false}
            indicatorStyle="default"
          />
        )}
      </View>

      {/* CTA concluir */}
      <View style={styles.footerCtaArea}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Concluir"
          style={styles.primaryBtn}
          activeOpacity={0.9}
          onPress={onConcluir}
        >
          <Text style={styles.primaryBtnText}>Concluir</Text>
        </TouchableOpacity>
      </View>

      {/* Barra dourada padrão */}
      <BottomBar fixed />
    </SafeAreaView>
  );
};

export default ResultsScreen;

// ====== Estilos
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGray },
  headerArea: {
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.textDark },
  titleLine: {
    marginTop: 6,
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    opacity: 0.9,
  },
  actionGroup: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },

  sectionHeader: {
    marginTop: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  sectionDate: { color: colors.textMuted, fontSize: 13 },

  listCard: {
    marginTop: 12,
    marginBottom: 20,
    marginHorizontal: 14,
    height: 500,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    paddingHorizontal: 12,
  },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, backgroundColor: colors.borderAlt },

  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    backgroundColor: colors.backgroundGrayAlt2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  indexText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },

  rowTexts: { flex: 1 },
  rowTitle: { color: colors.gold, fontSize: 15, fontWeight: '800' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  rowStatus: { fontSize: 14, fontWeight: '700', marginLeft: 12 },

  footerCtaArea: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: colors.backgroundGray,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
