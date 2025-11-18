import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { AppHeader, PopUpRequestBluetooth } from '@presentation/components';
import { BottomBar } from '@/ui/BottomBar';
import { colors } from '@presentation/theme';

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  onNavigateToTestHistory?: () => void;
  onNavigateToGenericError?: () => void;
  onNavigateToPopUpBluetooth?: () => void;
  onNavigateToAvailableTests?: () => void;
  onNavigateToSelectWells?: () => void;
  onNavigateToPreTestInstructions?: () => void;
  onNavigateToTestInProgress?: () => void;
  onNavigateToSampleIdentification?: () => void;
}

const HomologationTemp: React.FC<Props> = ({
  onBack,
  onGoHome,
  onNavigateToTestHistory,
  onNavigateToGenericError,
  onNavigateToPopUpBluetooth,
  onNavigateToAvailableTests,
  onNavigateToSelectWells,
  onNavigateToPreTestInstructions,
  onNavigateToTestInProgress,
  onNavigateToSampleIdentification,
}) => {
  const [showBluetoothPopup, setShowBluetoothPopup] = useState(false);
  const [popupMode, setPopupMode] = useState<'request' | 'error'>('request');

  const handleRequestBluetooth = () => {
    setPopupMode('request');
    setShowBluetoothPopup(true);
  };

  const handleBluetoothPermission = () => {
    // Simular sucesso ou erro após 2 segundos para teste
    setTimeout(() => {
      setPopupMode('error');
    }, 2000);
  };

  const handleBluetoothRetry = () => {
    setPopupMode('request');
  };

  const handleCloseBluetoothPopup = () => {
    setShowBluetoothPopup(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader {...(onBack && { onBack })} {...(onGoHome && { onGoHome })} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Homologação Temporária</Text>
            <Text style={styles.subtitle}>
              Tela em desenvolvimento para testes de homologação
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToTestHistory}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Histórico de Testes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToGenericError}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Erros Genéricos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={handleRequestBluetooth}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Request Bluetooth</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToAvailableTests}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Testes Disponíveis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToSelectWells}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>
                Seleção de Poços (Cinomose)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToPreTestInstructions}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Instruções Pré-Teste</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToTestInProgress}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>Teste em Andamento</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={onNavigateToSampleIdentification}
              activeOpacity={0.8}
            >
              <Text style={styles.navButtonText}>
                Identificação de Amostras
              </Text>
            </TouchableOpacity>
          </View>

          {/* <View style={styles.card}>
            <Text style={styles.cardTitle}>Status</Text>
            <Text style={styles.cardText}>
              Esta tela está sendo desenvolvida para testes de homologação.
              Em breve terá funcionalidades específicas implementadas.
            </Text>
          </View> */}

          {/* <View style={styles.card}>
            <Text style={styles.cardTitle}>Funcionalidades</Text>
            <Text style={styles.cardText}>
              • Testes de interface{'\n'}
              • Validação de componentes{'\n'}
              • Verificação de fluxos{'\n'}
              • Análise de performance
            </Text>
          </View> */}

          {/* <View style={styles.card}>
            <Text style={styles.cardTitle}>Próximos Passos</Text>
            <Text style={styles.cardText}>
              Aguarde as próximas instruções para implementação das funcionalidades específicas desta tela.
            </Text>
          </View> */}
        </View>
      </ScrollView>

      <BottomBar fixed />

      {/* Popup de solicitação Bluetooth */}
      <PopUpRequestBluetooth
        visible={showBluetoothPopup}
        mode={popupMode}
        onPrimary={
          popupMode === 'error'
            ? handleBluetoothRetry
            : handleBluetoothPermission
        }
        onClose={handleCloseBluetoothPopup}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 110, // Espaço para o BottomBar fixo
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  navButton: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: colors.shadowColor,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  navButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    shadowColor: colors.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
});

export default HomologationTemp;
