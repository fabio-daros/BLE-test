import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  FlatList,
  Modal,
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
import {
  attachPreTestMonitors,
  detachPreTestMonitors,
  PreTestSubscriptions,
} from '../../services/bluetooth/preTest/preTestReader';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';

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

export const BluetoothConnectionScreen: React.FC<BluetoothConnectionScreenProps> = ({ onBack }) => {
  const [manager] = useState(() => new BleManager());
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [receivedData, setReceivedData] = useState<string[]>([]);
  const [logsModalVisible, setLogsModalVisible] = useState(false);

  const isMountedRef = useRef(true);
  const hasTriedRestoreRef = useRef(false);

  const connectedDeviceRef = useRef<Device | null>(null);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preTestSubsRef = useRef<PreTestSubscriptions | null>(null);


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
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 31) {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        const allGranted = Object.values(granted).every(
          v => v === PermissionsAndroid.RESULTS.GRANTED,
        );
        if (!allGranted) {
          Alert.alert('Permissões', 'Conceda as permissões de Bluetooth nas configurações.');
          return false;
        }
        return true;
      } catch (e: any) {
        addLog(`Erro ao solicitar permissões (API31+): ${e?.message || String(e)}`);
        return false;
      }
    }

    try {
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permissão', 'Conceda a permissão de Localização para escanear BLE.');
        return false;
      }
      return true;
    } catch (e: any) {
      addLog(`Erro ao solicitar Location (<=30): ${e?.message || String(e)}`);
      return false;
    }
  };

  /**
   * ATENÇÃO:
   * Por causa do bug de SafePromise/SafeReadCharacteristic da lib BLE,
   * a leitura periódica foi desativada. Mantive a função apenas para log.
   */
  const startPeriodicRead = (_device: Device) => {
    addLog(
      'Leitura periódica desativada temporariamente (bug da lib BLE com SafePromise). ' +
      'Conexão estável, mas sem leitura automática de dados.',
    );
  };

  /**
   * Aqui só inspecionamos serviços/características e logamos.
   * Não registramos monitor nem fazemos read para evitar o bug nativo.
   */
  const startMonitoringDevice = async (device: Device) => {
    try {
      addLog('=== Preparando monitoramento (SEM leituras/monitores ativos) ===');
      const services = await device.services();
      let notifyCount = 0;

      addLog(`Inspecionando ${services.length} serviços...`);

      for (const service of services) {
        try {
          const characteristics = await service.characteristics();
          addLog(`Serviço ${service.uuid}: ${characteristics.length} características`);

          for (const char of characteristics) {
            if (char.isNotifiable) notifyCount++;
            addLog(
              `  Característica ${char.uuid}: readable=${char.isReadable}, writable=${char.isWritableWithResponse || char.isWritableWithoutResponse
              }, notifiable=${char.isNotifiable}`,
            );
          }
        } catch (err: any) {
          addLog(
            `❌ Erro ao processar serviço ${service.uuid}: ${err?.message || String(err)
            }`,
          );
        }
      }

      addLog(
        `Encontradas ${notifyCount} características notificáveis. ` +
        'Monitoramento por notificações/leitura está desativado por enquanto para evitar crashes.',
      );

      // se no futuro quisermos reativar algo simples, chamamos aqui:
      startPeriodicRead(device);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      addLog(`Erro ao preparar monitoramento: ${errorMsg}`);
      console.error('[BLE] Erro ao iniciar monitoramento:', error);
    }
  };

  const tryRestoreLastConnectedDevice = async () => {
  try {
    const savedId = await AsyncStorage.getItem('@lastConnectedDeviceId');
    if (!savedId) {
      addLog('Nenhum último device salvo para restaurar.');
      return;
    }

    addLog(`Tentando restaurar conexão com device: ${savedId}...`);

    const alreadyConnected = await manager.isDeviceConnected(savedId);
    addLog(`isDeviceConnected(${savedId}) = ${alreadyConnected}`);

    let device: Device | null = null;

    if (alreadyConnected) {
      // 1) tenta pegar devices já conectados pelo SERVICE_UUID
      addLog(
        'Device já está conectado no nativo – tentando recuperar via connectedDevices()...',
      );

      const byService = await manager.connectedDevices([SERVICE_UUID]);
      const foundById = byService.find(d => d.id === savedId) ?? null;

      if (foundById) {
        device = foundById;
        addLog(
          `Instância do device recuperada via connectedDevices: ${
            device.name || device.id
          }`,
        );
      } else {
        addLog(
          'connectedDevices() não retornou instância. Tentando manager.devices([id])...',
        );

        const byId = await manager.devices([savedId]);
        if (byId[0]) {
          device = byId[0];
          addLog('Instância do device recuperada via manager.devices().');
        } else {
          addLog(
            'Nenhuma instância encontrada; tentando connectToDevice como último recurso...',
          );
          try {
            device = await manager.connectToDevice(savedId, {
              autoConnect: true,
            });
            addLog(
              'connectToDevice funcionou na restauração mesmo com isDeviceConnected=true.',
            );
          } catch (err: any) {
            addLog(
              `Falha em connectToDevice na restauração: ${
                err?.message || String(err)
              }`,
            );
          }
        }
      }
    } else {
      // 2) se o Android disser que não está conectado, tenta reconectar normal
      addLog('Device não está conectado – tentando connectToDevice...');
      device = await manager.connectToDevice(savedId, { autoConnect: true });
      addLog(
        `Reconectado a ${device.name || device.id} após restart do bundle`,
      );
    }

    if (!device) {
      addLog(
        'Falha ao restaurar device: instância nula. Limpando último device salvo.',
      );
      await AsyncStorage.removeItem('@lastConnectedDeviceId');
      return;
    }

    // 3) Atualiza refs e estado para a UI mostrar "Conectado"
    connectedDeviceRef.current = device;
    setConnectedDevice(device);
    setDevices([
      {
        id: device.id,
        name: device.name,
        rssi: null,
        isConnected: true,
        device,
      },
    ]);

    await device.discoverAllServicesAndCharacteristics();
    addLog('Serviços redescobertos após restauração');

    await startMonitoringDevice(device);

    device.onDisconnected(async () => {
      addLog(`Desconectado de ${device.name || device.id} (restaurado)`);

      try {
        await AsyncStorage.removeItem('@lastConnectedDeviceId');
        addLog(
          'Último device conectado removido do armazenamento (onDisconnected)',
        );
      } catch (e: any) {
        addLog(
          `Erro ao limpar último device conectado (onDisconnected): ${
            e?.message || String(e)
          }`,
        );
      }

      if (preTestSubsRef.current) {
        detachPreTestMonitors(preTestSubsRef.current, addLog);
        preTestSubsRef.current = null;
      }

      connectedDeviceRef.current = null;

      if (isMountedRef.current) {
        setDevices(prev =>
          prev.map(d =>
            d.id === device.id ? { ...d, isConnected: false } : d,
          ),
        );
        setConnectedDevice(null);
        setReceivedData([]);
      }
    });
  } catch (e: any) {
    addLog(
      `Falha ao restaurar conexão com último device: ${
        e?.message || String(e)
      }`,
    );
  }
};


  useEffect(() => {
    isMountedRef.current = true;
    logger.info('BluetoothConnectionScreen carregada', {}, 'navigation');
    addLog('Inicializando BluetoothConnectionScreen...');
    console.log('[BLE] Inicializando BleManager...');

    let subscription: any = null;

    try {
      subscription = manager.onStateChange(
        (state: BleState) => {
          if (!isMountedRef.current) return;
          const enabled = state === 'PoweredOn';
          setBluetoothEnabled(enabled);
          addLog(`Estado do Bluetooth: ${state}`);

          if (state === 'PoweredOn') {
            if (!hasTriedRestoreRef.current) {
              hasTriedRestoreRef.current = true;
              addLog('Bluetooth ON – tentando restaurar último device conectado...');
              tryRestoreLastConnectedDevice();
            }
          }

          if (state === 'PoweredOff') {
            if (isScanning) setIsScanning(false);
            try {
              manager.stopDeviceScan();
              addLog('Scan parado (Bluetooth desligado)');
            } catch (e: any) {
              addLog(`Aviso ao parar scan: ${e?.message || String(e)}`);
            }
          }
        },
        true,
      );
      addLog('Listener de estado registrado (com estado inicial)');
    } catch (error: any) {
      console.warn(
        '[BLE] Erro ao registrar listener com true, tentando com false:',
        error,
      );
      addLog(`Erro ao registrar listener: ${error?.message || String(error)}`);

      try {
        subscription = manager.onStateChange(
          (state: BleState) => {
            if (!isMountedRef.current) return;
            const enabled = state === 'PoweredOn';
            setBluetoothEnabled(enabled);
            addLog(`Estado do Bluetooth: ${state}`);

            if (state === 'PoweredOn') {
              if (!hasTriedRestoreRef.current) {
                hasTriedRestoreRef.current = true;
                addLog(
                  'Bluetooth ON – tentando restaurar último device conectado (fallback)...',
                );
                tryRestoreLastConnectedDevice();
              }
            }

            if (state === 'PoweredOff') {
              if (isScanning) setIsScanning(false);
              try {
                manager.stopDeviceScan();
                addLog('Scan parado (Bluetooth desligado)');
              } catch (e: any) {
                addLog(`Aviso ao parar scan: ${e?.message || String(e)}`);
              }
            }
          },
          false,
        );
        addLog('Listener de estado registrado (sem estado inicial)');
      } catch (fallbackError: any) {
        console.error(
          '[BLE] Erro ao registrar listener com false também:',
          fallbackError,
        );
        addLog(
          `ERRO CRÍTICO: Não foi possível registrar listener: ${fallbackError?.message || String(fallbackError)
          }`,
        );
      }
    }

    return () => {
      // Ao sair da tela, NÃO vamos derrubar a conexão nem destruir o manager.
      // Só removemos o listener e paramos o scan.
      isMountedRef.current = false;
      addLog('Saindo da tela de Bluetooth (mantendo conexão ativa)...');

      try {
        if (subscription) {
          subscription.remove();
        }
      } catch (e: any) {
        console.warn('[BLE] Erro ao remover subscription:', e);
      }

      try {
        manager.stopDeviceScan();
        addLog('Scan parado no unmount.');
      } catch {
        // ignora
      }

      // Não chama dev.cancelConnection()
      // Não limpa @lastConnectedDeviceId
      // Não chama manager.destroy()
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager]);

  const enableBluetooth = async () => {
    const ok = await requestPermissions();
    if (!ok) return;

    if (bluetoothEnabled) {
      addLog('Bluetooth já está habilitado');
      Alert.alert('Bluetooth', 'O Bluetooth já está ligado.');
    } else {
      try {
        addLog('Verificando estado do Bluetooth...');
        manager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            const errorCode = (error as any)?.errorCode;
            if (errorCode === 102 || errorCode === 'BluetoothStateChangeFailed') {
              addLog('Bluetooth confirmado como desligado');
              Alert.alert(
                'Bluetooth Desligado',
                'Por favor, ligue o Bluetooth nas configurações do dispositivo.',
              );
            } else {
              addLog(`Erro ao verificar: ${error?.message || String(error)}`);
            }
            try {
              manager.stopDeviceScan();
            } catch { }
            return;
          }
          if (device) {
            addLog('Bluetooth está habilitado (dispositivo encontrado)');
            setBluetoothEnabled(true);
            try {
              manager.stopDeviceScan();
            } catch { }
            Alert.alert('Bluetooth', 'O Bluetooth está ligado.');
          }
        });

        setTimeout(() => {
          try {
            manager.stopDeviceScan();
          } catch { }
        }, 100);
      } catch (e: any) {
        addLog(`Erro ao verificar estado: ${e?.message || String(e)}`);
        Alert.alert(
          'Bluetooth Desligado',
          'Por favor, ligue o Bluetooth nas configurações do dispositivo.',
        );
      }
    }
  };

  const startScan = async () => {
    addLog('=== Iniciando startScan ===');

    if (!bluetoothEnabled) {
      addLog('Scan bloqueado: Bluetooth OFF');
      Alert.alert('Aviso', 'Por favor, habilite o Bluetooth primeiro.');
      return;
    }

    // Se já está escaneando, esse clique serve para PARAR manualmente
    if (isScanning) {
      try {
        manager.stopDeviceScan();
        setIsScanning(false);
        addLog('Scan parado manualmente pelo usuário.');
      } catch (e: any) {
        addLog(`Erro ao parar scan: ${e?.message || String(e)}`);
      }

      // limpa timeout pendente, se houver
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      return;
    }

    try {
      const currentlyConnected = connectedDeviceRef.current;

      if (!currentlyConnected) {
        // se não tiver nada conectado, aí sim limpamos tudo
        setDevices([]);
      } else {
        // garante que o device conectado esteja na lista e marcado como isConnected = true
        setDevices(prev => {
          const exists = prev.find(d => d.id === currentlyConnected.id);

          if (exists) {
            return prev.map(d =>
              d.id === currentlyConnected.id
                ? {
                  ...d,
                  isConnected: true,
                  device: currentlyConnected,
                }
                : d,
            );
          }

          // se não estava na lista, adiciona ele
          return [
            {
              id: currentlyConnected.id,
              name: currentlyConnected.name,
              rssi: null,
              isConnected: true,
              device: currentlyConnected,
            },
            ...prev,
          ];
        });
      }

      setIsScanning(true);
      addLog('Iniciando scan de dispositivos...');

      // garante que não exista timeout antigo pendurado
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      // ⏱ timeout automático do scan (ex: 10 segundos)
      scanTimeoutRef.current = setTimeout(() => {
        try {
          manager.stopDeviceScan();
          addLog('Scan parado automaticamente por timeout (10s).');
        } catch (e: any) {
          addLog(`Erro ao parar scan no timeout: ${e?.message || String(e)}`);
        }

        if (isMountedRef.current) {
          setIsScanning(false);
        }

        scanTimeoutRef.current = null;
      }, 10000); // 10.000 ms = 10s

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          const msg = (error as any)?.message || 'Erro desconhecido';
          const code = (error as any)?.errorCode || 'N/A';
          const reason = (error as any)?.reason || 'N/A';
          addLog(`ERRO no scan: ${msg}`);
          addLog(`Código: ${code}, Razão: ${reason}`);
          if (isMountedRef.current) setIsScanning(false);

          // em caso de erro, limpa timeout e para scan
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
          }
          try {
            manager.stopDeviceScan();
          } catch { }
          return;
        }

        if (!device || !isMountedRef.current) {
          return;
        }

        const name = (device.name || '').trim();
        if (!name.includes('InPunto')) {
          return;
        }

        setDevices(prev => {
          const idx = prev.findIndex(d => d.id === device.id);
          if (idx >= 0) {
            const updated = [...prev];
            const existing = updated[idx];
            updated[idx] = {
              id: device.id,
              name: device.name,
              rssi: device.rssi,
              isConnected: existing?.isConnected || false,
              device,
            };
            return updated;
          }
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
        });
      });

      addLog('Scan iniciado com sucesso');
    } catch (e: any) {
      addLog(`ERRO ao iniciar scan: ${e?.message || String(e)}`);
      setIsScanning(false);

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      Alert.alert('Erro', `Não foi possível iniciar o scan: ${e?.message || e}`);
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

      connectedDeviceRef.current = device;
      setConnectedDevice(device);

      setDevices(prev =>
        prev.map(d =>
          d.id === deviceItem.id ? { ...d, isConnected: true, device } : d,
        ),
      );

      await device.discoverAllServicesAndCharacteristics();
      addLog('Serviços descobertos');

      try {
        await AsyncStorage.setItem('@lastConnectedDeviceId', device.id);
        addLog(`Último device conectado salvo: ${device.id}`);
      } catch (e: any) {
        addLog(
          `Erro ao salvar último device conectado: ${e?.message || String(e)
          }`,
        );
      }

      const services = await device.services();
      addLog(`Encontrados ${services.length} serviços`);

      for (const service of services) {
        addLog(`Serviço: ${service.uuid}`);
        try {
          const characteristics = await service.characteristics();
          addLog(`  - ${characteristics.length} características encontradas`);

          for (const char of characteristics) {
            addLog(
              `    • ${char.uuid} (read: ${char.isReadable}, write: ${char.isWritableWithResponse || char.isWritableWithoutResponse
              }, notify: ${char.isNotifiable})`,
            );
          }
        } catch (err: any) {
          addLog(
            `  - Erro ao ler características: ${err?.message || String(err)
            }`,
          );
        }
      }

      await startMonitoringDevice(device);

      try {
        preTestSubsRef.current = await attachPreTestMonitors(device, msg => {
          // 1) manda pro log da tela
          addLog(msg);

          // 2) opcional: joga também em "Dados Recebidos" pra você ver separado
          setReceivedData(prev => [msg, ...prev].slice(0, 100));
        });
        addLog('✅ Monitores de pré-teste anexados ao dispositivo.');
      } catch (e: any) {
        addLog(
          `❌ Erro ao anexar monitores de pré-teste: ${e?.message || String(e)}`,
        );
      }

      device.onDisconnected(async () => {
        addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);

        connectedDeviceRef.current = null;

        try {
          await AsyncStorage.removeItem('@lastConnectedDeviceId');
          addLog('Último device conectado removido do armazenamento (onDisconnected)');
        } catch (e: any) {
          addLog(
            `Erro ao limpar último device conectado (onDisconnected): ${e?.message || String(e)
            }`,
          );
        }

        if (preTestSubsRef.current) {
          detachPreTestMonitors(preTestSubsRef.current, addLog);
          preTestSubsRef.current = null;
        }

        if (isMountedRef.current) {
          setDevices(prev =>
            prev.map(d =>
              d.id === deviceItem.id
                ? { ...d, isConnected: false }
                : d,
            ),
          );
          setConnectedDevice(null);
          setReceivedData([]);
        }
      });

      Alert.alert('Sucesso', `Conectado a ${deviceItem.name || deviceItem.id}`);
    } catch (e: any) {
      addLog(`Erro ao conectar: ${e?.message || String(e)}`);
      Alert.alert('Erro', `Não foi possível conectar: ${e?.message || e}`);
    } finally {
      setIsConnecting(null);
    }
  };

  const disconnectDevice = async (deviceItem: DeviceItem) => {
    try {
      if (!deviceItem.isConnected && !connectedDeviceRef.current) {
        addLog(
          `Ignorando desconectar: ${deviceItem.name || deviceItem.id} já está desconectado.`,
        );
        return;
      }

      addLog(`Desconectando de ${deviceItem.name || deviceItem.id}...`);

      try {
        const isConnectedNow = await deviceItem.device.isConnected();
        if (isConnectedNow) {
          await deviceItem.device.cancelConnection();
        }
      } catch (e: any) {
        addLog(
          `Aviso ao cancelar conexão (pode já estar desconectado): ${e?.message || String(e)
          }`,
        );
      }

      connectedDeviceRef.current = null;

      if (preTestSubsRef.current) {
        detachPreTestMonitors(preTestSubsRef.current, addLog);
        preTestSubsRef.current = null;
      }

      addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);

      if (isMountedRef.current) {
        setDevices(prev =>
          prev.map(d =>
            d.id === deviceItem.id ? { ...d, isConnected: false } : d,
          ),
        );
        setConnectedDevice(null);
        setReceivedData([]);
      }

      try {
        await AsyncStorage.removeItem('@lastConnectedDeviceId');
        addLog('Último device conectado removido do armazenamento (disconnect)');
      } catch (e: any) {
        addLog(
          `Erro ao limpar último device conectado (disconnect): ${e?.message || String(e)
          }`,
        );
      }
    } catch (e: any) {
      addLog(`Erro ao desconectar: ${e?.message || String(e)}`);
      Alert.alert('Erro', `Não foi possível desconectar: ${e?.message || e}`);
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
            RSSI{' '}
            {item.rssi !== null ? `${item.rssi} dBm` : 'N/A'}
          </Text>
          {item.isConnected && (
            <Text style={styles.connectedLabel}>● Conectado</Text>
          )}
        </View>
        <View style={styles.deviceActions}>
          {item.isConnected ? (
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={() => disconnectDevice(item)}
            >
              <Text style={styles.disconnectButtonText}>Desconectar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.connectButton,
                disabled && styles.connectButtonDisabled,
              ]}
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
            style={[
              styles.enableButton,
              bluetoothEnabled && styles.enableButtonActive,
            ]}
            onPress={enableBluetooth}
          >
            <Text
              style={[
                styles.enableButtonText,
                bluetoothEnabled && styles.enableButtonTextActive,
              ]}
            >
              {bluetoothEnabled
                ? 'Bluetooth Habilitado'
                : 'Habilitar Bluetooth'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.scanButton,
            isScanning && styles.scanButtonActive,
          ]}
          onPress={startScan}
        >
          {isScanning ? (
            <View style={styles.scanButtonContent}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.scanButtonText}>Parar Scan</Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>
              Escanear Dispositivos
            </Text>
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

        {connectedDevice && receivedData.length > 0 && (
          <View style={styles.logsContainer}>
            <Text style={styles.sectionTitle}>
              Dados Recebidos ({receivedData.length})
            </Text>
            <ScrollView style={styles.logsScroll}>
              {receivedData.map((data, index) => (
                <Text
                  key={index}
                  style={[styles.logText, styles.dataText]}
                >
                  {data}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.logsContainer}>
          <View style={styles.logsHeader}>
            <Text style={styles.sectionTitle}>
              Logs ({logs.length})
            </Text>
            <TouchableOpacity
              style={styles.openModalButton}
              onPress={() => setLogsModalVisible(true)}
            >
              <Text style={styles.openModalButtonText}>
                Abrir em Tela Cheia
              </Text>
            </TouchableOpacity>
          </View>
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

        <Modal
          visible={logsModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setLogsModalVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Logs do Bluetooth ({logs.length})
              </Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setLogsModalVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalLogsScroll}>
              {logs.map((log, index) => (
                <Text key={index} style={styles.modalLogText}>
                  {log}
                </Text>
              ))}
              {logs.length === 0 && (
                <Text style={styles.modalEmptyText}>
                  Nenhum log ainda
                </Text>
              )}
            </ScrollView>
            {receivedData.length > 0 && (
              <View style={styles.modalDataSection}>
                <Text style={styles.modalSectionTitle}>
                  Dados Recebidos ({receivedData.length})
                </Text>
                <ScrollView style={styles.modalDataScroll}>
                  {receivedData.map((data, index) => (
                    <Text
                      key={index}
                      style={[
                        styles.modalLogText,
                        styles.modalDataText,
                      ]}
                    >
                      {data}
                    </Text>
                  ))}
                </ScrollView>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg },
  headerSection: { marginBottom: spacing.md },
  enableButton: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  enableButtonActive: { backgroundColor: colors.gold },
  enableButtonText: { color: colors.gold, fontWeight: '600', fontSize: 16 },
  enableButtonTextActive: { color: colors.white },
  scanButton: {
    backgroundColor: colors.gold,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scanButtonActive: { backgroundColor: colors.errorAlt },
  scanButtonContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scanButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.textDark,
  },
  deviceList: { flex: 1, marginBottom: spacing.md },
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
  deviceInfo: { flex: 1, marginRight: spacing.sm },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  deviceId: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  deviceRssi: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  connectedLabel: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  deviceActions: { minWidth: 100 },
  connectButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButtonDisabled: { opacity: 0.6 },
  connectButtonText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  disconnectButton: {
    backgroundColor: colors.errorAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButtonText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  emptyContainer: { padding: spacing.lg, alignItems: 'center' },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  logsContainer: { height: 150, marginTop: spacing.md },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  openModalButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  openModalButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
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
  dataText: {
    color: colors.gold,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderAlt,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  closeModalButton: {
    backgroundColor: colors.errorAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  closeModalButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalLogsScroll: {
    flex: 1,
    padding: spacing.md,
  },
  modalLogText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 4,
    lineHeight: 18,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
    fontStyle: 'italic',
    fontSize: 14,
  },
  modalDataSection: {
    borderTopWidth: 2,
    borderTopColor: colors.gold,
    padding: spacing.md,
    backgroundColor: colors.goldBackground,
    maxHeight: 300,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.goldDark,
    marginBottom: spacing.sm,
  },
  modalDataScroll: {
    maxHeight: 250,
  },
  modalDataText: {
    color: colors.goldDark,
    fontWeight: '600',
  },
});
