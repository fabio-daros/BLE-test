import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useHardwareStatus } from '@services/hardware';
import { colors } from '@presentation/theme';

interface Props {
  onBack: () => void;
}

export const MachineStatusScreen: React.FC<Props> = ({ onBack }) => {
  const { status, connected } = useHardwareStatus();

  const formatHm = (hm?: { hours: number; minutes: number }) => {
    if (!hm) return '--:--';
    const h = String(hm.hours ?? 0).padStart(2, '0');
    const m = String(hm.minutes ?? 0).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} /> {/* 👈 Adicionar spacer invisível */}
        <Text style={styles.title}>Status do Equipamento</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Conexão: {connected ? 'Conectado' : 'Desconectado'}
        </Text>

        <View style={styles.card}>
          <Row
            label="Bateria"
            value={status ? `${status.batteryPercent}%` : '--'}
          />
          <Row
            label="Temp. do bloco"
            value={status ? `${status.blockTemperatureC}°C` : '--'}
          />
          <Row
            label="Tempo aquecimento"
            value={status ? formatHm(status.blockHeatingTime) : '--:--'}
          />
          <Row
            label="Status do equipamento"
            value={
              status
                ? status.equipmentStatus === 'analysis'
                  ? 'Em análise'
                  : 'Standby'
                : '--'
            }
          />
          <Row
            label="Decorrido"
            value={status ? formatHm(status.analysisElapsed) : '--:--'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt2,
    paddingTop: Platform.OS === 'android' ? 24 + 24 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
    position: 'relative',
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    marginTop: Platform.OS === 'android' ? -80 : 0,
    zIndex: 1,
  },
  headerSpacer: {
    width: 100,
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    marginRight: 0,
  },
  container: {
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
