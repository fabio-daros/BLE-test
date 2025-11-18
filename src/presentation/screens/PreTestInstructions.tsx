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
  Modal,
} from 'react-native';
import { AntDesign } from '@/utils/vector-icons-helper';
import { AppHeader, TemperaturePill } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { colors } from '@presentation/theme';
// import { ENV } from '@/config/env'; // Descomentar quando o backend estiver disponível

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;

  title?: string;
  subtitle?: string;
  steps?: string[];
  onPressTutorial?: () => void;
  onStart?: () => void;

  showTemperature?: boolean;
  temperatureLabel?: string;
  temperatureValue?: string;
  onCloseTemperature?: () => void;

  showDontShowAgain?: boolean;
  onPressDontShowAgain?: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOTTOM_GUARD = 110;
const CONTENT_W = Math.min(SCREEN_W * 0.9, 360);

const DEFAULT_STEPS: string[] = [
  'Abra a tampa.',
  'Retire a bandeja e apoie em uma superfície limpa, plana e firme.',
  'Encaixe na bandeja os tubos com a reação do teste escolhido.',
  'Abra apenas o tubo que vai receber a amostra, de acordo com a sequência definida no passo anterior.',
  'Adicione a amostra.',
  'Feche o tubo.',
  'Repita o processo a cada amostra.',
];

const PreTestInstructions: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
  title = 'Quase lá!',
  subtitle = 'Antes de iniciar, confira as orientações de operação:',
  steps = DEFAULT_STEPS,
  onPressTutorial,
  onStart,

  showTemperature = true,
  temperatureLabel = 'TEMPERATURA DO EQUIPAMENTO',
  temperatureValue = '63ºC',
  onCloseTemperature,

  showDontShowAgain = true,
  onPressDontShowAgain,
}) => {
  // ---- Pop-up de temperatura removido - agora usando componente TemperaturePill
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Função preparada para enviar preferências ao backend
  // TODO: Descomentar e implementar quando o backend estiver disponível
  const savePreferencesToBackend = async () => {
    try {
      // const response = await fetch(`${ENV.API_BASE_URL}/api/user/preferences`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     hidePreTestInstructions: true,
      //   }),
      // });
      // if (!response.ok) {
      //   throw new Error('Erro ao salvar preferências');
      // }
      // const data = await response.json();
      // console.log('Preferências salvas:', data);

      // Por enquanto, apenas log para desenvolvimento
      console.log('Preferências preparadas para envio ao backend:', {
        hidePreTestInstructions: true,
      });
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    }
  };

  const handleDontShowAgain = () => {
    // Salvar preferências (preparado para backend)
    savePreferencesToBackend();

    // Mostrar modal de confirmação
    setShowPreferencesModal(true);

    // Chamar callback se fornecido
    onPressDontShowAgain?.();

    // Auto-fechar modal após 3 segundos
    setTimeout(() => {
      setShowPreferencesModal(false);
    }, 3000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View pointerEvents="none" style={styles.decoTop} />
      <View pointerEvents="none" style={styles.decoBottom} />

      <AppHeader {...(onBack && { onBack })} {...(onGoHome && { onGoHome })} {...(onOpenHistory && { onOpenHistory })} />

      {/* Pop-up de temperatura usando componente TemperaturePill */}
      <TemperaturePill
        initialTempC={parseInt(temperatureValue.replace('ºC', ''))}
        tempLabel={temperatureLabel}
        tempMessage={null}
        startExpanded={true}
        initialX={16}
        initialY={52}
        onClose={() => {
          onCloseTemperature?.();
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: BOTTOM_GUARD }}
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ Container centralizado */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.listWrap}>
            {steps.map((t, i) => (
              <View key={i} style={styles.liRow}>
                <View style={styles.bullet} />
                <Text style={styles.liText}>{t}</Text>
              </View>
            ))}
          </View>

          {showDontShowAgain && (
            <TouchableOpacity
              onPress={handleDontShowAgain}
              style={styles.linkWrap}
              activeOpacity={0.8}
            >
              <Text style={styles.link}>Não mostrar novamente</Text>
            </TouchableOpacity>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.btn}
              onPress={onPressTutorial}
              activeOpacity={0.9}
            >
              <Text style={styles.btnText}>Assistir Tutorial</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btn}
              onPress={onStart}
              activeOpacity={0.9}
            >
              <Text style={styles.btnText}>Iniciar Pipetagem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomBar fixed />

      {/* Modal de confirmação de preferências atualizadas */}
      <Modal
        visible={showPreferencesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreferencesModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Ícone de sucesso */}
            <View style={styles.successIconWrap}>
              <AntDesign name="check" size={32} color={colors.white} />
            </View>

            {/* Título */}
            <Text style={styles.modalTitle}>Preferências atualizadas</Text>

            {/* Subtítulo */}
            <Text style={styles.modalSubtitle}>
              Não mostraremos as orientações de operação novamente.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
  },

  // Estilos do pop-up removidos - agora usando componente TemperaturePill

  header: { alignItems: 'center', marginTop: 24, marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: '400',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },

  listWrap: { marginTop: 12, width: '100%', gap: 10 },
  liRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: colors.textMuted,
  },
  liText: { color: colors.textPrimary, fontSize: 15, lineHeight: 22, flex: 1 },

  linkWrap: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 34,
  },
  link: { color: colors.link, fontSize: 13, textDecorationLine: 'underline' },

  buttons: { width: '100%', marginTop: 18, gap: 12 },
  btn: {
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  btnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },

  // Estilos do modal de confirmação
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.shadowAlt2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.backgroundBeige,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderBlue,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
    shadowColor: colors.shadowColor,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PreTestInstructions;
