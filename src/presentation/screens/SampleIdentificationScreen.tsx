import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { AntDesign } from '@/utils/vector-icons-helper';
import { TemperaturePill, AppHeader } from '@presentation/components';
import { colors } from '@presentation/theme';
import IdentificationPipeConfirmed from '@assets/IdentificationPipeConfirmed.svg';
import IdentificationPipeNotConfirmed from '@assets/IdentificationPipeNotConfirmed.svg';
import IconMic from '@assets/Icone-mic.svg';

type SampleIdentificationScreenProps = {
  totalTubes: number;
  initialIndex?: number;
  /** Números reais das células selecionadas (ex: [1, 5, 15]) */
  wellNumbers?: number[];
  onFinish?: (_labels: string[]) => void;
  onCancelBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;
};

export const SampleIdentificationScreen: React.FC<
  SampleIdentificationScreenProps
> = ({
  totalTubes,
  initialIndex = 0,
  wellNumbers,
  onFinish,
  onCancelBack,
  onGoHome,
  onOpenHistory,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [labels, setLabels] = useState<string[]>(() =>
    Array(totalTubes).fill('')
  );
  const [confirmedLabels, setConfirmedLabels] = useState<string[]>(() =>
    Array(totalTubes).fill('')
  );
  const [currentText, setCurrentText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const SLIDE_WIDTH = 200; // Largura fixa de cada slide
  const isScrollingRef = useRef(false);

  // quando trocar de tubo, sincroniza o input com o valor salvo
  useEffect(() => {
    setCurrentText(labels[currentIndex] ?? '');
  }, [currentIndex, labels]);

  // Sincroniza o scroll quando o índice muda programaticamente (mas não durante scroll manual)
  useEffect(() => {
    if (!isScrollingRef.current && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: currentIndex * SLIDE_WIDTH,
        animated: true,
      });
    }
  }, [currentIndex]);

  const isLast = currentIndex === totalTubes - 1;
  const confirmDisabled = currentText.trim().length === 0;

  // Verifica se todas as amostras anteriores foram confirmadas (exceto a atual se for a última)
  const allPreviousConfirmed = useMemo(() => {
    if (!isLast) return true; // Se não for a última, não precisa verificar

    // Para a última, verifica se todas as anteriores estão confirmadas
    for (let i = 0; i < totalTubes - 1; i++) {
      const label = confirmedLabels[i];
      if (!label || label.trim().length === 0) {
        return false;
      }
    }
    return true;
  }, [confirmedLabels, isLast, totalTubes]);

  // Botão Finalizar habilitado quando: é a última E tem texto E todas anteriores confirmadas
  const finishDisabled = isLast && (confirmDisabled || !allPreviousConfirmed);

  const handleConfirm = () => {
    if (confirmDisabled) return;

    const trimmedText = currentText.trim();
    const nextLabels = [...labels];
    const nextConfirmed = [...confirmedLabels];

    nextLabels[currentIndex] = trimmedText;
    nextConfirmed[currentIndex] = trimmedText; // Marca como confirmada
    setLabels(nextLabels);
    setConfirmedLabels(nextConfirmed);

    if (isLast) {
      // Envia todas as amostras confirmadas
      onFinish?.(nextConfirmed.filter(label => label.trim().length > 0));
      return;
    }

    setCurrentIndex(prev => prev + 1);
  };

  const handleGoBackTube = () => {
    // salva o atual antes de voltar
    const nextLabels = [...labels];
    nextLabels[currentIndex] = currentText.trim();
    setLabels(nextLabels);

    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      isScrollingRef.current = true;
      setCurrentIndex(newIndex);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: newIndex * SLIDE_WIDTH,
          animated: true,
        });
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 300);
      }, 0);
    }
  };

  const handleGoNextTube = () => {
    // salva o atual antes de avançar
    const nextLabels = [...labels];
    nextLabels[currentIndex] = currentText.trim();
    setLabels(nextLabels);

    if (currentIndex < totalTubes - 1) {
      const newIndex = currentIndex + 1;
      isScrollingRef.current = true;
      setCurrentIndex(newIndex);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: newIndex * SLIDE_WIDTH,
          animated: true,
        });
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 300);
      }, 0);
    }
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    if (index !== currentIndex && index >= 0 && index < totalTubes) {
      // Salva o texto atual antes de mudar
      const nextLabels = [...labels];
      nextLabels[currentIndex] = currentText.trim();
      setLabels(nextLabels);
      isScrollingRef.current = true;
      setCurrentIndex(index);
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 300);
    }
  };

  const handleClearCurrent = () => {
    // Desconfirma a amostra atual e limpa o texto
    const nextConfirmed = [...confirmedLabels];
    nextConfirmed[currentIndex] = '';
    setConfirmedLabels(nextConfirmed);

    const nextLabels = [...labels];
    nextLabels[currentIndex] = '';
    setLabels(nextLabels);
    setCurrentText('');
  };

  // Verifica se a amostra atual está confirmada
  const isCurrentConfirmed =
    (confirmedLabels[currentIndex] ?? '').trim().length > 0;

  // Importando cores do sistema centralizado
  const themeColors = useMemo(
    () => ({
      bg: colors.backgroundWarm,
      text: colors.textDarkAlt,
      subtitle: colors.textMutedAlt2,
      gold: colors.goldAlt,
      grayLine: colors.borderAlt4,
      inputBg: colors.white,
      inputBorder: colors.borderAlt3,
      disabled: colors.disabledAlt,
    }),
    []
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.bg }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        {/* Pop-up de temperatura usando componente TemperaturePill */}
        <TemperaturePill
          initialTempC={31}
          tempLabel="TEMPERATURA DO EQUIPAMENTO"
          tempMessage={null}
          startExpanded={true}
          initialX={14}
          initialY={58}
          onClose={() => {
            // Callback opcional se necessário
          }}
        />

        {/* Header padrão */}
        <AppHeader
          {...(onCancelBack && { onBack: onCancelBack })}
          {...(onGoHome && { onGoHome })}
          {...(onOpenHistory && { onOpenHistory })}
        />

        <View style={styles.content}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              Identificação{'\n'}das Amostras
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.subtitle }]}>
              Use o campo abaixo para{'\n'}identificar cada amostra.
            </Text>
          </View>

          {/* Área do tubo com carrossel */}
          <View style={styles.tubeArea}>
            {/* Seta esquerda - anterior */}
            <TouchableOpacity
              onPress={handleGoBackTube}
              style={[
                styles.arrowButton,
                currentIndex === 0 && styles.arrowButtonDisabled,
              ]}
              disabled={currentIndex === 0}
              activeOpacity={0.7}
            >
              <AntDesign
                name="left"
                size={24}
                color={
                  currentIndex === 0 ? themeColors.disabled : themeColors.gold
                }
              />
            </TouchableOpacity>

            {/* ScrollView horizontal para permitir swipe */}
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              scrollEventThrottle={16}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              scrollEnabled={true}
            >
              {Array.from({ length: totalTubes }).map((_, index) => {
                const tubeLabel = confirmedLabels[index] ?? '';
                const hasLabel = tubeLabel.trim().length > 0;
                // Usa o número real da célula se disponível, senão usa index + 1
                const wellNumber = wellNumbers?.[index] ?? index + 1;

                return (
                  <View key={index} style={styles.tubeSlide}>
                    <View style={styles.tubeCenter}>
                      <Text
                        style={[
                          styles.tubeNumber,
                          {
                            color: hasLabel
                              ? themeColors.gold
                              : themeColors.subtitle,
                          },
                        ]}
                      >
                        {wellNumber}
                      </Text>

                      {/* SVG do tubo - usa confirmedLabels para mostrar o estado correto */}
                      <View
                        style={[
                          {
                            borderColor: hasLabel
                              ? themeColors.gold
                              : themeColors.subtitle,
                          },
                        ]}
                      >
                        {hasLabel ? (
                          <IdentificationPipeConfirmed
                            width={76}
                            height={136}
                          />
                        ) : (
                          <IdentificationPipeNotConfirmed
                            width={76}
                            height={136}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Seta direita - próximo */}
            <TouchableOpacity
              onPress={handleGoNextTube}
              style={[
                styles.arrowButton,
                currentIndex === totalTubes - 1 && styles.arrowButtonDisabled,
              ]}
              disabled={currentIndex === totalTubes - 1}
              activeOpacity={0.7}
            >
              <AntDesign
                name="right"
                size={24}
                color={
                  currentIndex === totalTubes - 1
                    ? themeColors.disabled
                    : themeColors.gold
                }
              />
            </TouchableOpacity>
          </View>

          {/* Progresso discreto */}
          <View style={styles.progressRow}>
            <Text style={{ color: themeColors.subtitle, fontSize: 12 }}>
              Tubo {currentIndex + 1} de {totalTubes}
            </Text>
            <View style={styles.progressDots}>
              {Array.from({ length: totalTubes }).map((_, i) => {
                const filled = i < currentIndex;
                const current = i === currentIndex;
                return (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      current
                        ? { backgroundColor: themeColors.gold, width: 14 }
                        : filled
                          ? { backgroundColor: themeColors.gold }
                          : { backgroundColor: colors.disabledAlt },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Input + mic */}
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: themeColors.inputBg },
            ]}
          >
            <TextInput
              value={currentText}
              onChangeText={setCurrentText}
              placeholder="Digite o rótulo da amostra"
              style={[
                styles.input,
                {
                  color: themeColors.text,
                  opacity: isCurrentConfirmed ? 0.6 : 1,
                },
              ]}
              placeholderTextColor={themeColors.subtitle}
              editable={!isCurrentConfirmed}
            />
            <TouchableOpacity
              style={styles.micButton}
              disabled={isCurrentConfirmed}
            >
              <View style={{ opacity: isCurrentConfirmed ? 0.6 : 1 }}>
                <IconMic
                  width={24}
                  height={24}
                  fill={themeColors.subtitle}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Botão Confirmar/Finalizar - só aparece se não estiver confirmado */}
          {!isCurrentConfirmed && (
            <TouchableOpacity
              style={[
                styles.confirmButton,
                {
                  backgroundColor: isLast
                    ? finishDisabled
                      ? themeColors.disabled
                      : themeColors.gold
                    : confirmDisabled
                      ? themeColors.disabled
                      : themeColors.gold,
                },
              ]}
              activeOpacity={
                isLast ? (finishDisabled ? 1 : 0.7) : confirmDisabled ? 1 : 0.7
              }
              onPress={handleConfirm}
              disabled={isLast ? finishDisabled : confirmDisabled}
            >
              <Text style={styles.confirmButtonText}>
                {isLast ? 'Finalizar' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Limpar - só visível quando há algo confirmado ou texto digitado */}
          {(isCurrentConfirmed || currentText.trim().length > 0) && (
            <TouchableOpacity
              onPress={handleClearCurrent}
              style={styles.clearButton}
            >
              <Text
                style={{
                  color: themeColors.subtitle,
                  textDecorationLine: 'underline',
                }}
              >
                {isCurrentConfirmed ? 'Desconfirmar e Limpar' : 'Limpar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* footer barra dourada */}
        <View
          style={[styles.footerBar, { backgroundColor: themeColors.gold }]}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
  },
  headerText: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  tubeArea: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderAlt3,
    marginHorizontal: 8,
  },
  arrowButtonDisabled: {
    opacity: 0.4,
  },
  scrollView: {
    flex: 1,
    maxWidth: 200,
    minWidth: 200,
  },
  scrollContent: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  tubeSlide: {
    width: 200, // Largura fixa para cada slide
    alignItems: 'center',
    justifyContent: 'center',
  },
  tubeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tubeNumber: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressRow: {
    marginTop: 18,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  progressDot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderAlt3,
    paddingLeft: 14,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    height: 46,
  },
  micButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    marginTop: 24,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 12,
    alignSelf: 'center',
  },
  footerBar: {
    height: 14,
    width: '100%',
  },
});
