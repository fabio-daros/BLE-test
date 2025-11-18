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

    let subscription: any = null;

    // Aguardar um pouco antes de registrar o listener para garantir que o módulo nativo está pronto
    const initTimeout = setTimeout(() => {
      try {
        addLog('Registrando listener de mudanças de estado do Bluetooth...');
        console.log('[BLE] Registrando onStateChange listener...');
        
        subscription = manager.onStateChange(
          state => {
            try {
              console.log('[BLE] onStateChange callback chamado, estado:', state);
              if (isMountedRef.current) {
                const enabled = state === 'PoweredOn';
                setBluetoothEnabled(enabled);
                addLog(`Estado do Bluetooth: ${state}`);
                console.log('[BLE] Estado atualizado:', { state, enabled });
                if (state === 'PoweredOff') {
                  setIsScanning(false);
                  try {
                    manager.stopDeviceScan();
                    addLog('Scan parado (Bluetooth desligado)');
                  } catch (error: any) {
                    console.warn('[BLE] Erro ao parar scan:', error);
                    addLog(`Aviso: ${error?.message || 'Erro ao parar scan'}`);
                  }
                }
              }
            } catch (callbackError: any) {
              console.error('[BLE] Erro no callback onStateChange:', callbackError);
              addLog(`Erro no callback: ${callbackError?.message || String(callbackError)}`);
            }
          },
          false // false = não retorna estado imediatamente (mais seguro)
        );

        addLog('Listener de estado registrado com sucesso');
        console.log('[BLE] onStateChange listener registrado com sucesso');

        // Verificar estado após um pequeno delay
        setTimeout(async () => {
          try {
            const currentState = await manager.state();
            console.log('[BLE] Estado verificado após delay:', currentState);
            if (isMountedRef.current) {
              const enabled = currentState === 'PoweredOn';
              setBluetoothEnabled(enabled);
              addLog(`Estado verificado: ${currentState}`);
            }
          } catch (stateError: any) {
            console.error('[BLE] Erro ao verificar estado após delay:', stateError);
            addLog(`Erro ao verificar estado: ${stateError?.message || String(stateError)}`);
            // Não bloquear a UI, apenas logar o erro
          }
        }, 1000);
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        const errorCode = (error as any)?.errorCode || 'N/A';
        const errorReason = (error as any)?.reason || 'N/A';
        const errorStack = error?.stack || 'N/A';
        console.error('[BLE] Erro ao inicializar BluetoothConnectionScreen:', error);
        console.error('[BLE] Error details:', {
          message: errorMsg,
          code: errorCode,
          reason: errorReason,
          stack: errorStack,
        });
        addLog(`ERRO na inicialização: ${errorMsg}`);
        addLog(`Código: ${errorCode}, Razão: ${errorReason}`);
        logger.error('Erro ao inicializar Bluetooth', { 
          error: errorMsg, 
          code: errorCode,
          reason: errorReason,
          stack: errorStack 
        }, 'bluetooth');
      }
    }, 500); // Aguardar 500ms antes de inicializar

    return () => {
      clearTimeout(initTimeout);
      console.log('[BLE] Limpando recursos do BluetoothConnectionScreen...');
      isMountedRef.current = false;
      if (subscription) {
        try {
          subscription.remove();
          addLog('Listener de estado removido');
        } catch (error: any) {
          console.warn('[BLE] Erro ao remover subscription:', error);
        }
      }
    };
  }, [manager]);

//   const addLog = (message: string) => {
//     if (!isMountedRef.current) return;
//     const timestamp = new Date().toLocaleTimeString();
//     setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
//     logger.info(message, { timestamp }, 'bluetooth');
//   };

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

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+ (API 31+)
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted = Object.values(granted).every(
            status => status === PermissionsAndroid.RESULTS.GRANTED,
          );

          if (!allGranted) {
            Alert.alert(
              'Permissões Necessárias',
              'Por favor, conceda todas as permissões necessárias nas configurações do app.',
            );
            return false;
          }
          return true;
        } catch (err: any) {
          addLog(`Erro ao solicitar permissões: ${err}`);
          return false;
        }
      } else {
        // Android < 12
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err: any) {
          addLog(`Erro ao solicitar permissões: ${err}`);
          return false;
        }
      }
    }
    return true; // iOS permissões são solicitadas automaticamente
  };
  const enableBluetooth = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }
  
    // Aqui a gente confia no estado vindo do onStateChange
    if (bluetoothEnabled) {
      addLog('Bluetooth já está habilitado');
      Alert.alert('Bluetooth', 'O Bluetooth já está ligado.');
    } else {
      addLog('Bluetooth está desligado (aguardando usuário ligar no sistema)');
      Alert.alert(
        'Bluetooth Desligado',
        'Por favor, ligue o Bluetooth nas configurações do dispositivo e volte para o app.',
      );
    }
  };

//   const enableBluetooth = async () => {
//     addLog('=== Iniciando enableBluetooth ===');
//     console.log('[BLE] enableBluetooth chamado');

//     try {
//       addLog('Solicitando permissões...');
//       console.log('[BLE] Verificando permissões...');
//       const hasPermission = await requestPermissions();
//       console.log('[BLE] Permissões concedidas:', hasPermission);
      
//       if (!hasPermission) {
//         addLog('Permissões não concedidas');
//         console.warn('[BLE] Permissões negadas pelo usuário');
//         return;
//       }

//       addLog('Permissões concedidas, verificando estado do Bluetooth...');
//       console.log('[BLE] Chamando manager.state()...');
      
//       try {
//         const state = await manager.state();
//         console.log('[BLE] manager.state() retornou:', state);
//         addLog(`Estado do Bluetooth obtido: ${state}`);
        
//         if (state === 'PoweredOff') {
//           addLog('Bluetooth está desligado');
//           Alert.alert(
//             'Bluetooth Desligado',
//             'Por favor, ligue o Bluetooth nas configurações do dispositivo.',
//           );
//         } else if (state === 'PoweredOn') {
//           setBluetoothEnabled(true);
//           addLog('Bluetooth já está habilitado');
//           console.log('[BLE] Bluetooth habilitado com sucesso');
//         } else {
//           addLog(`Estado do Bluetooth: ${state}`);
//           console.log('[BLE] Estado intermediário:', state);
//         }
//       } catch (stateError: any) {
//         const stateErrorMsg = stateError?.message || String(stateError);
//         const stateErrorCode = stateError?.errorCode || 'N/A';
//         const stateErrorReason = stateError?.reason || 'N/A';
//         const stateErrorStack = stateError?.stack || 'N/A';
        
//         console.error('[BLE] Erro ao chamar manager.state():', stateError);
//         console.error('[BLE] Error details:', {
//           message: stateErrorMsg,
//           code: stateErrorCode,
//           reason: stateErrorReason,
//           stack: stateErrorStack,
//           fullError: JSON.stringify(stateError, Object.getOwnPropertyNames(stateError)),
//         });
        
//         addLog(`ERRO ao verificar estado: ${stateErrorMsg}`);
//         addLog(`Código: ${stateErrorCode}, Razão: ${stateErrorReason}`);
        
//         logger.error('Erro ao verificar estado do Bluetooth', {
//           message: stateErrorMsg,
//           code: stateErrorCode,
//           reason: stateErrorReason,
//           stack: stateErrorStack,
//         }, 'bluetooth');
        
//         Alert.alert(
//           'Erro',
//           `Não foi possível verificar o estado do Bluetooth.\n\nErro: ${stateErrorMsg}\nCódigo: ${stateErrorCode}\nRazão: ${stateErrorReason}`
//         );
//       }
//     } catch (error: any) {
//       const errorMsg = error?.message || String(error);
//       const errorStack = error?.stack || 'N/A';
//       console.error('[BLE] Erro geral em enableBluetooth:', error);
//       console.error('[BLE] Stack trace:', errorStack);
//       addLog(`ERRO GERAL: ${errorMsg}`);
//       logger.error('Erro geral em enableBluetooth', { error: errorMsg, stack: errorStack }, 'bluetooth');
//       Alert.alert('Erro', `Erro inesperado: ${errorMsg}`);
//     }
//   };

  const startScan = async () => {
    addLog('=== Iniciando startScan ===');
    console.log('[BLE] startScan chamado');
    console.log('[BLE] bluetoothEnabled:', bluetoothEnabled);
    console.log('[BLE] isScanning:', isScanning);

    if (!bluetoothEnabled) {
      addLog('Bluetooth não está habilitado');
      console.warn('[BLE] Tentativa de scan sem Bluetooth habilitado');
      Alert.alert('Aviso', 'Por favor, habilite o Bluetooth primeiro.');
      return;
    }

    if (isScanning) {
      addLog('Parando scan atual...');
      console.log('[BLE] Parando scan...');
      try {
        manager.stopDeviceScan();
        setIsScanning(false);
        addLog('Scan parado');
        console.log('[BLE] Scan parado com sucesso');
      } catch (error: any) {
        console.error('[BLE] Erro ao parar scan:', error);
        addLog(`Erro ao parar scan: ${error?.message || String(error)}`);
      }
      return;
    }

    try {
      addLog('Limpando lista de dispositivos...');
      setDevices([]);
      setIsScanning(true);
      addLog('Iniciando scan de dispositivos...');
      console.log('[BLE] Chamando manager.startDeviceScan()...');

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          const errorMsg = error?.message || 'Erro desconhecido';
          const errorCode = (error as any)?.errorCode || 'N/A';
          const errorReason = (error as any)?.reason || 'N/A';
          
          console.error('[BLE] Erro no callback do scan:', error);
          console.error('[BLE] Error details:', {
            message: errorMsg,
            code: errorCode,
            reason: errorReason,
            fullError: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : 'N/A',
          });
          
          addLog(`ERRO no scan: ${errorMsg}`);
          addLog(`Código: ${errorCode}, Razão: ${errorReason}`);
          
          if (isMountedRef.current) {
            setIsScanning(false);
          }
          return;
        }

        if (device) {
          console.log('[BLE] Dispositivo encontrado:', {
            id: device.id,
            name: device.name,
            rssi: device.rssi,
          });
          
          if (isMountedRef.current) {
            setDevices(prev => {
              const existingIndex = prev.findIndex(d => d.id === device.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                const existingDevice = updated[existingIndex];
                updated[existingIndex] = {
                  id: device.id,
                  name: device.name,
                  rssi: device.rssi,
                  isConnected: existingDevice?.isConnected || false,
                  device: device,
                };
                addLog(`Dispositivo atualizado: ${device.name || device.id}`);
                return updated;
              } else {
                addLog(`Novo dispositivo encontrado: ${device.name || device.id}`);
                return [
                  ...prev,
                  {
                    id: device.id,
                    name: device.name,
                    rssi: device.rssi,
                    isConnected: false,
                    device: device,
                  },
                ];
              }
            });
          }
        }
      });
      
      addLog('Scan iniciado com sucesso');
      console.log('[BLE] startDeviceScan chamado com sucesso');
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const errorStack = error?.stack || 'N/A';
      console.error('[BLE] Erro ao iniciar scan:', error);
      console.error('[BLE] Stack trace:', errorStack);
      addLog(`ERRO ao iniciar scan: ${errorMsg}`);
      setIsScanning(false);
      logger.error('Erro ao iniciar scan', { error: errorMsg, stack: errorStack }, 'bluetooth');
      Alert.alert('Erro', `Não foi possível iniciar o scan: ${errorMsg}`);
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

      // Atualizar estado do dispositivo
      setDevices(prev =>
        prev.map(d =>
          d.id === deviceItem.id ? {...d, isConnected: true, device: device} : d,
        ),
      );

      // Descobrir serviços
      await device.discoverAllServicesAndCharacteristics();
      addLog('Serviços descobertos');

      // Monitorar desconexão
      device.onDisconnected(() => {
        addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);
        if (isMountedRef.current) {
          setDevices(prev =>
            prev.map(d => (d.id === deviceItem.id ? {...d, isConnected: false} : d)),
          );
        }
      });

      Alert.alert('Sucesso', `Conectado a ${deviceItem.name || deviceItem.id}`);
    } catch (error: any) {
      addLog(`Erro ao conectar: ${error.message}`);
      Alert.alert('Erro', `Não foi possível conectar: ${error.message}`);
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
        prev.map(d => (d.id === deviceItem.id ? {...d, isConnected: false} : d)),
      );
    } catch (error: any) {
      addLog(`Erro ao desconectar: ${error.message}`);
      Alert.alert('Erro', `Não foi possível desconectar: ${error.message}`);
    }
  };

  const renderDeviceItem = ({item}: {item: DeviceItem}) => {
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
              onPress={() => disconnectDevice(item)}>
              <Text style={styles.disconnectButtonText}>Desconectar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.connectButton,
                disabled && styles.connectButtonDisabled,
              ]}
              onPress={() => connectToDevice(item)}
              disabled={disabled}>
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
            style={[
              styles.enableButton,
              bluetoothEnabled && styles.enableButtonActive,
            ]}
            onPress={enableBluetooth}>
            <Text
              style={[
                styles.enableButtonText,
                bluetoothEnabled && styles.enableButtonTextActive,
              ]}>
              {bluetoothEnabled ? 'Bluetooth Habilitado' : 'Habilitar Bluetooth'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={startScan}
          disabled={!bluetoothEnabled}>
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
    shadowOffset: {width: 0, height: 1},
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

