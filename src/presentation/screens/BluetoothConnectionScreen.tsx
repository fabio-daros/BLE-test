import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { BleManager, Device, State as BleState } from 'react-native-ble-plx';
import { colors, spacing } from '@presentation/theme';
import { logger } from '@services/logging';
import { AppHeader } from '@presentation/components';

interface DeviceItem {
  id: string;
  name: string | null;
  rssi: number | null;
  isConnected: boolean;
  device: Device;
}

interface BluetoothConnectionScreenProps {
  onBack: () => void;
}

export const BluetoothConnectionScreen: React.FC<BluetoothConnectionScreenProps> = ({
  onBack,
}) => {
  const [manager] = useState(() => new BleManager());
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const managerRef = useRef<BleManager | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    managerRef.current = manager;

    logger.info('BluetoothConnectionScreen carregada', {}, 'navigation');
    addLog('Inicializando BluetoothConnectionScreen...');
    console.log('[BLE] Inicializando BleManager...');

    // Listener do estado do Bluetooth — com "true" para retornar o estado atual imediatamente.
    const subscription = manager.onStateChange(
      (state: BleState) => {
        try {
          console.log('[BLE] onStateChange estado:', state);
          if (!isMountedRef.current) return;

          const enabled = state === 'PoweredOn';
          setBluetoothEnabled(enabled);
          addLog(`Estado do Bluetooth: ${state}`);

          if (state === 'PoweredOff') {
            if (isScanning) setIsScanning(false);
            try {
              manager.stopDeviceScan();
              addLog('Scan parado (Bluetooth desligado)');
            } catch (e: any) {
              console.warn('[BLE] Erro ao parar scan:', e);
              addLog(`Aviso: ${e?.message || 'Erro ao parar scan'}`);
            }
          }
        } catch (callbackError: any) {
          console.error('[BLE] Erro no onStateChange:', callbackError);
          addLog(`Erro no callback: ${callbackError?.message || String(callbackError)}`);
        }
      },
      true // ✅ estado atual imediatamente + futuras mudanças
    );

    return () => {
      console.log('[BLE] Limpando BluetoothConnectionScreen...');
      isMountedRef.current = false;
      try {
        subscription.remove();
        addLog('Listener de estado removido');
      } catch (e: any) {
        console.warn('[BLE] Erro ao remover subscription:', e);
      }
    };
  }, [manager, isScanning]);

  const addLog = (message: any) => {
    if (!isMountedRef.current) return;
    const timestamp = new Date().toLocaleTimeString();

    const text =
      typeof message === 'string'
        ? message
        : JSON.stringify(message, Object.getOwnPropertyNames(message), 2);

    setLogs(prev => [`[${timestamp}] ${text}`, ...prev.slice(0, 49)]);
    logger.info(text, { timestamp }, 'bluetooth');
  };

  /**
   * Versão segura para obter o estado atual:
   * 1) Tenta manager.state();
   * 2) Se cair no bug (BleError "Unknown error... PromiseImpl.reject code=null"),
   *    faz fallback com um one-shot via onStateChange(..., true) + timeout.
   */
  const getCurrentBleState = async (mgr: BleManager, timeoutMs = 800): Promise<BleState | null> => {
    try {
      const s = await mgr.state();
      return s;
    } catch (err: any) {
      addLog(
        `state() falhou, aplicando fallback: ${err?.message || String(err)} | reason=${err?.reason || 'N/A'}`
      );
      return await new Promise<BleState | null>(resolve => {
        let resolved = false;
        const sub = mgr.onStateChange((s: BleState) => {
          if (!resolved) {
            resolved = true;
            try { sub.remove(); } catch {}
            resolve(s);
          }
        }, true);
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            try { sub.remove(); } catch {}
            resolve(null);
          }
        }, timeoutMs);
      });
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    // ✅ Android 12+: só BLE
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        // NÃO pedir ACCESS_FINE_LOCATION aqui
        // Se você fizer advertising:
        // PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      ]);

      const allGranted = Object.values(granted).every(
        s => s === PermissionsAndroid.RESULTS.GRANTED
      );
      if (!allGranted) {
        Alert.alert('Permissões', 'Conceda as permissões de Bluetooth nas configurações.');
        return false;
      }
      return true;
    } catch (e) {
      addLog(`Erro ao solicitar permissões (API31+): ${e}`);
      return false;
    }
  }

  // ✅ Android <= 30: precisa de Location para scan
  try {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Permissão', 'Conceda a permissão de Localização para escanear BLE.');
      return false;
    }
    return true;
  } catch (e) {
    addLog(`Erro ao solicitar Location (<=30): ${e}`);
    return false;
  }
};


  /**
   * Habilitar Bluetooth (igual ao app que funciona):
   * - Pede permissões;
   * - Obtém estado atual (usando getCurrentBleState com fallback seguro);
   * - Orienta o usuário se estiver desligado.
   */
  const enableBluetooth = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const state = await getCurrentBleState(manager);
    addLog(`Estado atual (enableBluetooth): ${state ?? 'desconhecido'}`);

    if (state === 'PoweredOn') {
      setBluetoothEnabled(true);
      addLog('Bluetooth já está habilitado');
      Alert.alert('Bluetooth', 'O Bluetooth já está ligado.');
    } else if (state === 'PoweredOff') {
      setBluetoothEnabled(false);
      addLog('Bluetooth desligado — peça para ligar no sistema');
      Alert.alert(
        'Bluetooth Desligado',
        'Por favor, ligue o Bluetooth nas configurações do dispositivo.'
      );
      // Dica: você pode abrir a tela de BT com react-native-android-open-settings, se quiser.
    } else {
      // Outros estados: 'TurningOn', 'TurningOff', 'Unsupported', 'Unauthorized', etc.
      addLog(`Estado do Bluetooth: ${state}`);
      Alert.alert('Aviso', `Estado do Bluetooth: ${state ?? 'desconhecido'}`);
    }
  };

  const startScan = async () => {
    addLog('=== Iniciando startScan ===');
    console.log('[BLE] startScan chamado');

    // Garante que o estado usado é o mais fresco possível
    const stateNow = await getCurrentBleState(manager);
    const isOn = stateNow === 'PoweredOn' || bluetoothEnabled;

    if (!isOn) {
      addLog(`Scan bloqueado: Bluetooth ${stateNow ?? 'desconhecido'}`);
      Alert.alert('Aviso', 'Por favor, habilite o Bluetooth primeiro.');
      return;
    }

    if (isScanning) {
      addLog('Parando scan atual...');
      try {
        manager.stopDeviceScan();
        setIsScanning(false);
        addLog('Scan parado');
      } catch (error: any) {
        addLog(`Erro ao parar scan: ${error?.message || String(error)}`);
      }
      return;
    }

    try {
      setDevices([]);
      setIsScanning(true);
      addLog('Iniciando scan de dispositivos...');

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          const errorMsg = error?.message || 'Erro desconhecido';
          const errorCode = (error as any)?.errorCode || 'N/A';
          const errorReason = (error as any)?.reason || 'N/A';

          addLog(`ERRO no scan: ${errorMsg}`);
          addLog(`Código: ${errorCode}, Razão: ${errorReason}`);

          if (isMountedRef.current) setIsScanning(false);
          return;
        }

        if (device) {
          if (isMountedRef.current) {
            setDevices(prev => {
              const existingIndex = prev.findIndex(d => d.id === device.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                  id: device.id,
                  name: device.name,
                  rssi: device.rssi,
                  isConnected: updated[existingIndex].isConnected,
                  device,
                };
                return updated;
              } else {
                return [
                  ...prev,
                  {
                    id: device.id,
                    name: device.name,
                    rssi: device.rssi,
                    isConnected: false,
                    device,
                  },
                ];
              }
            });
          }
        }
      });

      addLog('Scan iniciado com sucesso');
    } catch (error: any) {
      addLog(`ERRO ao iniciar scan: ${error?.message || String(error)}`);
      setIsScanning(false);
      Alert.alert('Erro', `Não foi possível iniciar o scan: ${error?.message || error}`);
    }
  };

  const connectToDevice = async (deviceItem: DeviceItem) => {
    if (deviceItem.isConnected) {
      addLog(`Já conectado a ${deviceItem.name || deviceItem.id}`);
      return;
    }

    try {
      setIsConnecting(deviceItem.id);
      addLog(`Conectando a ${deviceItem.name || deviceItem.id}...`);
      const device = await deviceItem.device.connect();
      addLog(`Conectado a ${device.name || device.id}`);

      setDevices(prev =>
        prev.map(d =>
          d.id === deviceItem.id ? { ...d, isConnected: true, device } : d,
        ),
      );

      await device.discoverAllServicesAndCharacteristics();
      addLog('Serviços descobertos');

      device.onDisconnected(() => {
        addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);
        if (isMountedRef.current) {
          setDevices(prev =>
            prev.map(d => (d.id === deviceItem.id ? { ...d, isConnected: false } : d)),
          );
        }
      });

      Alert.alert('Sucesso', `Conectado a ${deviceItem.name || deviceItem.id}`);
    } catch (error: any) {
      addLog(`Erro ao conectar: ${error?.message || String(error)}`);
      Alert.alert('Erro', `Não foi possível conectar: ${error?.message || error}`);
    } finally {
      setIsConnecting(null);
    }
  };

  const disconnectDevice = async (deviceItem: DeviceItem) => {
    try {
      addLog(`Desconectando de ${deviceItem.name || deviceItem.id}...`);
      await deviceItem.device.cancelConnection();
      addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);
      setDevices(prev =>
        prev.map(d => (d.id === deviceItem.id ? { ...d, isConnected: false } : d)),
      );
    } catch (error: any) {
      addLog(`Erro ao desconectar: ${error?.message || String(error)}`);
      Alert.alert('Erro', `Não foi possível desconectar: ${error?.message || error}`);
    }
  };

  const renderDeviceItem = ({ item }: { item: DeviceItem }) => {
    const isConnectingDevice = isConnecting === item.id;
    const disabled = isConnectingDevice;

    return (
      <View style={styles.deviceItem}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>
            {item.name || 'Dispositivo Desconhecido'}
          </Text>
          <Text style={styles.deviceId}>ID: {item.id}</Text>
          <Text style={styles.deviceRssi}>
            RSSI: {item.rssi !== null ? `${item.rssi} dBm` : 'N/A'}
          </Text>
          {item.isConnected && (
            <Text style={styles.connectedLabel}>● Conectado</Text>
          )}
        </View>
        <View style={styles.deviceActions}>
          {item.isConnected ? (
            <TouchableOpacity
              style={[styles.disconnectButton]}
              onPress={() => disconnectDevice(item)}
            >
              <Text style={styles.disconnectButtonText}>Desconectar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.connectButton, disabled && styles.connectButtonDisabled]}
              onPress={() => connectToDevice(item)}
              disabled={disabled}
            >
              {isConnectingDevice ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.connectButtonText}>Conectar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <AppHeader onBack={onBack} />

      <View style={styles.content}>
        <View style={styles.headerSection}>
          <TouchableOpacity
            style={[styles.enableButton, bluetoothEnabled && styles.enableButtonActive]}
            onPress={enableBluetooth}
          >
            <Text
              style={[
                styles.enableButtonText,
                bluetoothEnabled && styles.enableButtonTextActive,
              ]}
            >
              {bluetoothEnabled ? 'Bluetooth Habilitado' : 'Habilitar Bluetooth'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={startScan}
          disabled={false /* deixamos clicar; o método já barra se BT off */}
        >
          {isScanning ? (
            <View style={styles.scanButtonContent}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.scanButtonText}>Parar Scan</Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>Escanear Dispositivos</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          Dispositivos Encontrados ({devices.length})
        </Text>

        <FlatList
          data={devices}
          renderItem={renderDeviceItem}
          keyExtractor={item => item.id}
          style={styles.deviceList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {isScanning
                  ? 'Procurando dispositivos...'
                  : 'Nenhum dispositivo encontrado. Pressione "Escanear Dispositivos" para começar.'}
              </Text>
            </View>
          }
        />

        <View style={styles.logsContainer}>
          <Text style={styles.sectionTitle}>Logs</Text>
          <ScrollView style={styles.logsScroll}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))}
            {logs.length === 0 && (
              <Text style={styles.emptyText}>Nenhum log ainda</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.md,
  },
  enableButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  enableButtonActive: {
    backgroundColor: colors.gold,
  },
  enableButtonText: {
    color: colors.gold,
    fontWeight: '600',
    fontSize: 16,
  },
  enableButtonTextActive: {
    color: colors.white,
  },
  scanButton: {
    backgroundColor: colors.gold,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scanButtonActive: {
    backgroundColor: colors.errorAlt,
  },
  scanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.textDark,
  },
  deviceList: {
    flex: 1,
    marginBottom: spacing.md,
  },
  deviceItem: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  deviceId: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  connectedLabel: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  deviceActions: {
    minWidth: 100,
  },
  connectButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  disconnectButton: {
    backgroundColor: colors.errorAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  logsContainer: {
    height: 150,
    marginTop: spacing.md,
  },
  logsScroll: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.sm,
    maxHeight: 150,
  },
  logText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 2,
  },
});
