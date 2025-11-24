// AvailableTests.tsx
import React, {
  memo,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@/utils/vector-icons-helper';
import { AppHeader } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { memoryTestProfileRepository } from '@data/storage';
import { TestProfile } from '@/types/test-profile';
import { useNavigationLogger } from '@services/logging';
import { colors } from '../theme';
import { useTemperatureBlockConfig } from '@/services/bluetooth/temperatureBlock';

export type TestKey = 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom';

interface TestItem {
  id: number;
  key: TestKey;
  label: string;
  temperatureC: number;
  incubation: string;
  activeProfile: TestProfile;
}

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;
  onSelectTest?: (key: TestKey) => void;
  onConfirmSelection?: (key: TestKey, profile?: TestProfile) => void;
  tests?: TestItem[];
}

const BOTTOM_GUARD = 120;

const SYNC_INTERVAL_MS = 5000;

const AvailableTests: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
  onSelectTest,
  onConfirmSelection,
}) => {
  const [selected, setSelected] = useState<number | null>(null); // ID do perfil selecionado
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [canScroll, setCanScroll] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  const layoutHeightRef = useRef(0);
  const anchorBottomRef = useRef(0);
  const scrollOffsetRef = useRef(0);

  const { logUserAction } = useNavigationLogger({
    screenName: 'AvailableTests',
    additionalContext: { hasProfileIntegration: true },
  });

  const { sendProfileConfig, isSending } = useTemperatureBlockConfig();

  const convertProfilesToTestItems = (
    activeProfiles: TestProfile[]
  ): TestItem[] => {
    return activeProfiles.map(profile => {
      const getLabel = (testType: string, profileName: string): string => {
        const typeLabels: Record<string, string> = {
          cinomose: 'Cinomose',
          ibv_geral: 'IBV Geral',
          ibv_especifico: 'IBV Específico',
          custom: profileName,
        };
        return typeLabels[testType] || profileName;
      };

      const formatIncubation = (minutes: number): string => {
        if (minutes === 0) return '0min';
        return `${minutes}min`;
      };

      return {
        id: profile.id,
        key: profile.testType as TestKey,
        label: getLabel(profile.testType, profile.name),
        temperatureC: profile.targetTemperature,
        incubation: formatIncubation(profile.totalTime.minutes),
        activeProfile: profile,
      };
    });
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);

      const activeProfiles =
        await memoryTestProfileRepository.findByStatus('active');

      const testItems = convertProfilesToTestItems(activeProfiles);
      setTests(testItems);

      logUserAction('profiles_loaded_for_tests', {
        totalActiveProfiles: activeProfiles.length,
        testsGenerated: testItems.length,
      });
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      logUserAction('profiles_load_error', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();

    syncIntervalRef.current = setInterval(() => {
      loadProfiles();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  const handleSelect = (profileId: number) => {
    setSelected(curr => (curr === profileId ? null : profileId)); // toggle
    const test = tests.find(t => t.id === profileId);
    if (test?.activeProfile) {
      onSelectTest?.(test.key);
      logUserAction('test_selected_with_profile', {
        testType: test.key,
        profileId: test.activeProfile.id,
        profileName: test.activeProfile.name,
      });
    }
  };

  const canConfirm = useMemo(
    () => !!selected && !isSending,
    [selected, isSending]
  );

  const updateScrollHintState = useCallback(() => {
    const layoutH = layoutHeightRef.current;
    const anchorBottom = anchorBottomRef.current;
    const offsetY = scrollOffsetRef.current;

    if (!layoutH || !anchorBottom) {
      setCanScroll(false);
      setShowScrollHint(false);
      return;
    }

    // Parte visível inferior da tela dentro do ScrollView
    const visibleBottom = layoutH + offsetY;

    // Dá pra rolar de fato?
    const canScrollNow = anchorBottom > layoutH + 4;
    setCanScroll(canScrollNow);

    if (!canScrollNow) {
      setShowScrollHint(false);
      return;
    }

    // Se o bottom do botão está abaixo da parte visível, mostra seta
    const threshold = 8; // almofadinha pra não piscar
    const shouldShowHint = anchorBottom > visibleBottom + threshold;
    setShowScrollHint(shouldShowHint);
  }, []); // 👈 Dependências vazias porque só usa refs

  // Função confirm - agora muito mais limpa usando o hook
  const confirm = async () => {
    if (!selected || isSending) {
      return;
    }

    const selectedTest = tests.find(t => t.id === selected);
    if (!selectedTest?.activeProfile) {
      return;
    }

    const profile = selectedTest.activeProfile;

    console.log('[AvailableTests] ========== CONFIRM CLICADO ==========');
    console.log('[AvailableTests] Perfil selecionado:', profile.name);

    // Enviar configuração ao hardware usando o hook
    const configSent = await sendProfileConfig(profile);

    if (!configSent) {
      console.warn('[AvailableTests] ⚠️ Configuração não foi enviada');
      Alert.alert(
        'Configuração não enviada',
        'Não foi possível enviar a configuração ao equipamento. O hardware não emitirá sinal sonoro. Deseja continuar mesmo assim?',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Continuar',
            onPress: () => {
              onConfirmSelection?.(selectedTest.key, profile);
              logUserAction('test_confirmed_with_profile', {
                testType: selectedTest.key,
                profileId: profile.id,
                profileName: profile.name,
                configSent: false,
              });
            },
          },
        ]
      );
      return;
    }

    // Configuração enviada com sucesso
    console.log(
      '[AvailableTests] ✅ Configuração enviada! Confirmando seleção...'
    );

    // Pequeno delay para garantir que o hardware processou
    await new Promise<void>(resolve => setTimeout(resolve, 200));

    onConfirmSelection?.(selectedTest.key, profile);
    logUserAction('test_confirmed_with_profile', {
      testType: selectedTest.key,
      profileId: profile.id,
      profileName: profile.name,
      configSent: true,
      temperature: profile.targetTemperature,
      reactionTime: profile.totalTime.minutes,
    });

    console.log('[AvailableTests] ✅ Seleção confirmada com sucesso!');
  };

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => { // 👈 Envolver em useCallback
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    updateScrollHintState();
  }, [updateScrollHintState]); // 👈 Adicionar dependência

  const handleScrollHintPress = useCallback(() => { // 👈 Envolver em useCallback
    if (!scrollViewRef.current) return;

    const targetY = anchorBottomRef.current - layoutHeightRef.current + 40;
    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
  }, []); // 👈 Sem dependências

  const handleScrollViewLayout = useCallback((event: LayoutChangeEvent) => { // 👈 Handler tipado
    const { height } = event.nativeEvent.layout;
    layoutHeightRef.current = height;
    updateScrollHintState();
  }, [updateScrollHintState]);

  const handleButtonContainerLayout = useCallback((event: LayoutChangeEvent) => { // 👈 Handler tipado
    const { y, height } = event.nativeEvent.layout;
    anchorBottomRef.current = y + height;
    updateScrollHintState();
  }, [updateScrollHintState]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* decorativos */}
      <View pointerEvents="none" style={styles.decoTop} />
      <View pointerEvents="none" style={styles.decoBottom} />

      {/* Header */}
      <AppHeader
        {...(onBack && { onBack })}
        {...(onGoHome && { onGoHome })}
        {...(onOpenHistory && { onOpenHistory })}
      />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        indicatorStyle="default"
        bounces={true}
        alwaysBounceVertical={false}
        scrollEventThrottle={16}
        onLayout={handleScrollViewLayout} // 👈 Usar handler tipado
        onScroll={handleScroll}
      >
        {/* Título */}
        <View style={styles.titleWrap}>
          <Text style={styles.titleStrong}>Lista de Testes</Text>
          <Text style={styles.titleLight}>Disponíveis</Text>
        </View>

        {/* Opções com expansão */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando testes...</Text>
          </View>
        ) : tests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhum teste disponível no momento
            </Text>
            <Text style={styles.emptySubtext}>
              Configure perfis ativos no painel administrativo
            </Text>
          </View>
        ) : (
          <View style={styles.options}>
            {tests.map(t => {
              const isSelected = selected === t.id;
              return (
                <ExpandableOption
                  key={t.id}
                  item={t}
                  selected={isSelected}
                  onPress={() => handleSelect(t.id)}
                  testID={`btn-test-${t.id}`}
                />
              );
            })}
          </View>
        )}


        <View
          onLayout={handleButtonContainerLayout}
        >
          <TouchableOpacity
            style={[styles.cta, !canConfirm && styles.ctaDisabled]}
            activeOpacity={canConfirm ? 0.9 : 1}
            onPress={confirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirm }}
          >
            <Text
              style={[styles.ctaText, !canConfirm && styles.ctaTextDisabled]}
            >
              Selecionar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {canScroll && showScrollHint && (
        <View style={styles.scrollHintContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.scrollHintBubble}
            activeOpacity={0.8}
            onPress={handleScrollHintPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Deslize para ver mais conteúdo"
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.goldAlt4}
            />
          </TouchableOpacity>
        </View>
      )}


      <BottomBar fixed />
    </SafeAreaView>
  );
};

const ExpandableOption = memo(function ExpandableOption({
  item,
  selected,
  onPress,
  testID,
}: {
  item: TestItem;
  selected: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.optionBtn, selected && styles.optionBtnSelected]}
      activeOpacity={0.9}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {item.label}
      </Text>

      {selected && (
        <View style={styles.expandedBox}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileTitle}>
              Perfil: {item.activeProfile.name}
            </Text>
            {item.activeProfile.description && (
              <Text style={styles.profileDescription}>
                {item.activeProfile.description}
              </Text>
            )}
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Temperatura: {item.activeProfile.targetTemperature}°C
            </Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Tempo: {item.activeProfile.totalTime.minutes}min
            </Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Tipo:{' '}
              {item.activeProfile.hardwareTestType === 'colorimetric'
                ? 'Colorimétrico'
                : 'Fluorimétrico'}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: BOTTOM_GUARD,
  },

  decoTop: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: 220,
    height: 120,
    backgroundColor: colors.backgroundGray,
    borderRadius: 28,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.55,
  },
  decoBottom: {
    position: 'absolute',
    bottom: -30,
    right: -40,
    width: 240,
    height: 120,
    backgroundColor: colors.backgroundGray,
    borderRadius: 28,
    transform: [{ rotate: '10deg' }],
    opacity: 0.35,
  },

  // título
  titleWrap: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 36,
  },
  titleStrong: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.goldAlt4,
  },
  titleLight: {
    marginTop: 2,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '400',
  },

  // opções
  options: {
    paddingHorizontal: 20,
    gap: 14,
  },
  optionBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderAlt2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  optionBtnSelected: {
    backgroundColor: colors.goldBackground,
    borderColor: colors.goldAlt4,
    shadowOpacity: 0.12,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: colors.goldAlt4,
  },

  expandedBox: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginTop: 10,
    gap: 10,
  },
  profileInfo: {
    marginBottom: 8,
  },
  profileTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.goldAlt4,
    textAlign: 'center',
    marginBottom: 4,
  },
  profileDescription: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d97706',
    textAlign: 'center',
  },
  warningSubtext: {
    fontSize: 11,
    color: '#92400e',
    textAlign: 'center',
    marginTop: 2,
  },
  pill: {
    backgroundColor: colors.goldBackgroundAlt2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldAlt4,
    opacity: 0.9,
  },

  // CTA
  cta: {
    alignSelf: 'center',
    marginTop: 100,
    width: '88%',
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: colors.goldAlt4,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: colors.disabled,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ctaTextDisabled: {
    color: '#9ca3af',
  },

  // Estados de loading e vazio
  loadingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Hint de scroll
  scrollHintContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_GUARD - 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollHintBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.goldAlt4,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AvailableTests;
