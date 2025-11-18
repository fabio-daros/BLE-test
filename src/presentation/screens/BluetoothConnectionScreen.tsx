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
import { BleManager, Device, State as BleState, Characteristic, Service } from 'react-native-ble-plx';
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

export const BluetoothConnectionScreen: React.FC<BluetoothConnectionScreenProps> = ({ onBack }) => {
  const [manager] = useState(() => new BleManager());
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [receivedData, setReceivedData] = useState<string[]>([]);
  const [monitoringSubscriptions, setMonitoringSubscriptions] = useState<any[]>([]);
  const monitoringSubscriptionsRef = useRef<any[]>([]);
  const [logsModalVisible, setLogsModalVisible] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    logger.info('BluetoothConnectionScreen carregada', {}, 'navigation');
    addLog('Inicializando BluetoothConnectionScreen...');
    console.log('[BLE] Inicializando BleManager...');

    let subscription: any = null;

    // Tentar usar onStateChange com true primeiro (retorna estado atual)
    // Se falhar, usar false como fallback
    try {
      subscription = manager.onStateChange(
        (state: BleState) => {
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
              addLog(`Aviso ao parar scan: ${e?.message || String(e)}`);
            }
          }
        },
        true // ✅ entrega o estado atual imediatamente e continua monitorando
      );
      addLog('Listener de estado registrado (com estado inicial)');
    } catch (error: any) {
      // Se falhar com true, tentar com false
      console.warn('[BLE] Erro ao registrar listener com true, tentando com false:', error);
      addLog(`Erro ao registrar listener: ${error?.message || String(error)}`);
      
      try {
        subscription = manager.onStateChange(
          (state: BleState) => {
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
                addLog(`Aviso ao parar scan: ${e?.message || String(e)}`);
              }
            }
          },
          false // Fallback: não retorna estado inicial, apenas monitora mudanças
        );
        addLog('Listener de estado registrado (sem estado inicial)');
      } catch (fallbackError: any) {
        console.error('[BLE] Erro ao registrar listener com false também:', fallbackError);
        addLog(`ERRO CRÍTICO: Não foi possível registrar listener: ${fallbackError?.message || String(fallbackError)}`);
      }
    }

    return () => {
      isMountedRef.current = false;
      if (subscription) {
        try {
          subscription.remove();
          addLog('Listener de estado removido');
        } catch (e: any) {
          console.warn('[BLE] Erro ao remover subscription:', e);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, isScanning]);

  const addLog = (message: any) => {
    if (!isMountedRef.current) return;
    const timestamp = new Date().toLocaleTimeString();
    const text = typeof message === 'string'
      ? message
      : JSON.stringify(message, Object.getOwnPropertyNames(message), 2);
    setLogs(prev => [`[${timestamp}] ${text}`, ...prev.slice(0, 49)]);
    logger.info(text, { timestamp }, 'bluetooth');
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 31) {
      // Android 12+: apenas permissões de BLE
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          // NÃO peça ACCESS_FINE_LOCATION aqui em 12+
        ]);
        const allGranted = Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
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

    // Android ≤ 30: precisa de Location
    try {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
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

  // ✅ NÃO chama manager.state() — usa só bluetoothEnabled
  const enableBluetooth = async () => {
    const ok = await requestPermissions();
    if (!ok) return;

    // Forçar uma atualização do estado tentando iniciar um scan temporário
    // Isso vai fazer o onStateChange ser chamado se o estado mudar
    // Mas não vamos realmente escanear, apenas verificar o estado
    if (bluetoothEnabled) {
      addLog('Bluetooth já está habilitado');
      Alert.alert('Bluetooth', 'O Bluetooth já está ligado.');
    } else {
      // Se bluetoothEnabled é false, pode ser que o callback ainda não foi chamado
      // Tentar forçar uma verificação iniciando e parando um scan
      try {
        addLog('Verificando estado do Bluetooth...');
        // Iniciar um scan muito curto apenas para forçar o sistema a verificar o estado
        manager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            const errorCode = (error as any)?.errorCode;
            if (errorCode === 102 || errorCode === 'BluetoothStateChangeFailed') {
              // Bluetooth está desligado
              addLog('Bluetooth confirmado como desligado');
              Alert.alert('Bluetooth Desligado', 'Por favor, ligue o Bluetooth nas configurações do dispositivo.');
            } else {
              // Outro erro, mas pode ser que o BT esteja ligado
              addLog(`Erro ao verificar: ${error?.message || String(error)}`);
            }
            try {
              manager.stopDeviceScan();
            } catch {}
            return;
          }
          // Se não há erro, o Bluetooth está ligado
          if (device) {
            addLog('Bluetooth está habilitado (dispositivo encontrado)');
            setBluetoothEnabled(true);
            try {
              manager.stopDeviceScan();
            } catch {}
            Alert.alert('Bluetooth', 'O Bluetooth está ligado.');
          }
        });
        
        // Parar o scan após 100ms
        setTimeout(() => {
          try {
            manager.stopDeviceScan();
          } catch {}
        }, 100);
      } catch (e: any) {
        addLog(`Erro ao verificar estado: ${e?.message || String(e)}`);
        Alert.alert('Bluetooth Desligado', 'Por favor, ligue o Bluetooth nas configurações do dispositivo.');
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

    if (isScanning) {
      try {
        manager.stopDeviceScan();
        setIsScanning(false);
        addLog('Scan parado');
      } catch (e: any) {
        addLog(`Erro ao parar scan: ${e?.message || String(e)}`);
      }
      return;
    }

    try {
      setDevices([]);
      setIsScanning(true);
      addLog('Iniciando scan de dispositivos...');

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          const msg = (error as any)?.message || 'Erro desconhecido';
          const code = (error as any)?.errorCode || 'N/A';
          const reason = (error as any)?.reason || 'N/A';
          addLog(`ERRO no scan: ${msg}`);
          addLog(`Código: ${code}, Razão: ${reason}`);
          if (isMountedRef.current) setIsScanning(false);
          return;
        }

        if (device && isMountedRef.current) {
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
        }
      });

      addLog('Scan iniciado com sucesso');
    } catch (e: any) {
      addLog(`ERRO ao iniciar scan: ${e?.message || String(e)}`);
      setIsScanning(false);
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

      setDevices(prev =>
        prev.map(d => (d.id === deviceItem.id ? { ...d, isConnected: true, device } : d)),
      );

      await device.discoverAllServicesAndCharacteristics();
      addLog('Serviços descobertos');

      // Listar todos os serviços e características
      const services = await device.services();
      addLog(`Encontrados ${services.length} serviços`);
      
      for (const service of services) {
        addLog(`Serviço: ${service.uuid}`);
        try {
          const characteristics = await service.characteristics();
          addLog(`  - ${characteristics.length} características encontradas`);
          
          for (const char of characteristics) {
            addLog(`    • ${char.uuid} (read: ${char.isReadable}, write: ${char.isWritableWithResponse || char.isWritableWithoutResponse}, notify: ${char.isNotifiable})`);
          }
        } catch (err: any) {
          addLog(`  - Erro ao ler características: ${err?.message || String(err)}`);
        }
      }

      // Tentar encontrar e monitorar características que suportam notificações
      await startMonitoringDevice(device);

      setConnectedDevice(device);

      device.onDisconnected(() => {
        addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);
        // Remover todas as subscriptions
        monitoringSubscriptionsRef.current.forEach(sub => {
          try {
            sub.remove();
          } catch {}
        });
        monitoringSubscriptionsRef.current = [];
        setMonitoringSubscriptions([]);
        if (isMountedRef.current) {
          setDevices(prev =>
            prev.map(d => (d.id === deviceItem.id ? { ...d, isConnected: false } : d)),
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

  const startMonitoringDevice = async (device: Device) => {
    try {
      addLog('=== Iniciando monitoramento do dispositivo ===');
      const services = await device.services();
      let foundNotifyCharacteristic = false;
      let notifyCount = 0;

      // Procurar por características que suportam notificações
      addLog(`Procurando características notificáveis em ${services.length} serviços...`);
      
      for (const service of services) {
        try {
          const characteristics = await service.characteristics();
          addLog(`Serviço ${service.uuid}: ${characteristics.length} características`);
          
          for (const char of characteristics) {
            addLog(`  Característica ${char.uuid}: readable=${char.isReadable}, writable=${char.isWritableWithResponse || char.isWritableWithoutResponse}, notifiable=${char.isNotifiable}`);
            
            if (char.isNotifiable) {
              addLog(`✓ Encontrada característica notificável: ${char.uuid}`);
              notifyCount++;
              
              try {
                addLog(`Tentando assinar notificações em ${char.uuid}...`);
                
                // Tentar habilitar notificações explicitamente (alguns dispositivos precisam disso)
                try {
                  // Ler o descriptor de notificação e habilitar
                  const descriptors = await char.descriptors();
                  for (const desc of descriptors) {
                    if (desc.uuid.toLowerCase().includes('2902') || desc.uuid.toLowerCase().includes('notification')) {
                      addLog(`Habilitando notificação via descriptor ${desc.uuid}...`);
                      try {
                        // Escrever 0x01 para habilitar notificações
                        await desc.write('AQ=='); // Base64 de [0x01, 0x00] ou apenas [0x01]
                        addLog(`✅ Notificação habilitada via descriptor`);
                      } catch (descError: any) {
                        addLog(`⚠️ Não foi possível habilitar via descriptor: ${descError?.message || String(descError)}`);
                      }
                    }
                  }
                } catch (descErr: any) {
                  addLog(`⚠️ Erro ao acessar descriptors: ${descErr?.message || String(descErr)}`);
                  // Continuar mesmo se falhar - o monitor pode funcionar sem isso
                }
                
                addLog(`Assinando monitor na característica ${char.uuid}...`);
                let callbackCount = 0; // Contador de callbacks para esta característica
                
                const subscription = char.monitor((error, characteristic) => {
                  callbackCount++;
                  const timestamp = new Date().toLocaleTimeString();
                  
                  console.log(`[BLE] Monitor callback #${callbackCount} chamado`, { 
                    timestamp,
                    charUuid: char.uuid,
                    error: error?.message, 
                    hasValue: !!characteristic?.value,
                    value: characteristic?.value,
                  });
                  
                  if (error) {
                    const errorMsg = error?.message || String(error);
                    const errorCode = (error as any)?.errorCode || 'N/A';
                    const errorReason = (error as any)?.reason || 'N/A';
                    addLog(`❌ [${timestamp}] Erro no monitor (callback #${callbackCount}): ${errorMsg} (code: ${errorCode}, reason: ${errorReason})`);
                    console.error('[BLE] Erro no monitor:', error);
                    return;
                  }
                  
                  // Logar SEMPRE que o callback for chamado, mesmo sem dados
                  if (characteristic?.value) {
                    const value = characteristic.value;
                    const dataLog = `[${timestamp}] 📥 DADOS RECEBIDOS (callback #${callbackCount}): ${value}`;
                    
                    console.log('[BLE] ✅ DADOS RECEBIDOS:', value);
                    addLog(dataLog);
                    
                    if (isMountedRef.current) {
                      setReceivedData(prev => [dataLog, ...prev.slice(0, 49)]);
                    }
                  } else {
                    // Logar que o callback foi chamado mas sem dados (pode ser um heartbeat ou confirmação)
                    console.log(`[BLE] Monitor callback #${callbackCount} chamado mas sem valor (pode ser heartbeat)`);
                    // Logar a cada 10 callbacks para não spam, mas sempre no primeiro
                    if (callbackCount === 1 || callbackCount % 10 === 0) {
                      addLog(`[${timestamp}] 💓 Monitor ativo na ${char.uuid} (callback #${callbackCount} sem dados ainda)`);
                    }
                  }
                });
                
                // Armazenar todas as subscriptions para poder remover depois
                setMonitoringSubscriptions(prev => {
                  const updated = [...prev, subscription];
                  monitoringSubscriptionsRef.current = updated;
                  return updated;
                });
                foundNotifyCharacteristic = true;
                addLog(`✅ Monitoramento iniciado com sucesso na característica ${char.uuid}`);
                console.log('[BLE] Monitoramento iniciado na característica:', char.uuid);
                
                // Continuar monitorando TODAS as características notificáveis (não fazer break)
              } catch (monitorError: any) {
                const errorMsg = monitorError?.message || String(monitorError);
                const errorCode = (monitorError as any)?.errorCode || 'N/A';
                addLog(`❌ Erro ao assinar notificações: ${errorMsg} (code: ${errorCode})`);
                console.error('[BLE] Erro ao assinar notificações:', monitorError);
              }
            }
          }
        } catch (err: any) {
          addLog(`❌ Erro ao processar serviço ${service.uuid}: ${err?.message || String(err)}`);
          console.error('[BLE] Erro ao processar serviço:', err);
        }
      }

      addLog(`Encontradas ${notifyCount} características notificáveis`);

      if (!foundNotifyCharacteristic) {
        addLog('⚠️ Nenhuma característica com notificações encontrada. Iniciando leitura periódica...');
        // Se não houver notificações, tentar ler periodicamente
        startPeriodicRead(device);
      } else {
        addLog('✅ Monitoramento ativo - aguardando dados do hardware...');
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const errorCode = (error as any)?.errorCode || 'N/A';
      addLog(`❌ Erro ao iniciar monitoramento: ${errorMsg} (code: ${errorCode})`);
      console.error('[BLE] Erro ao iniciar monitoramento:', error);
    }
  };

  const startPeriodicRead = (device: Device) => {
    addLog('Iniciando leitura periódica (a cada 1 segundo)...');
    let readCount = 0;
    
    const readInterval = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(readInterval);
        return;
      }

      readCount++;
      if (readCount % 10 === 0) {
        addLog(`Leitura periódica ativa (${readCount} tentativas)`);
      }

      try {
        const services = await device.services();
        for (const service of services) {
          try {
            const characteristics = await service.characteristics();
            for (const char of characteristics) {
              if (char.isReadable) {
                try {
                  const value = await char.read();
                  if (value?.value) {
                    const timestamp = new Date().toLocaleTimeString();
                    const dataLog = `[${timestamp}] 📖 Dados lidos: ${value.value}`;
                    console.log('[BLE] Dados lidos periodicamente:', value.value);
                    addLog(dataLog);
                    if (isMountedRef.current) {
                      setReceivedData(prev => [dataLog, ...prev.slice(0, 49)]);
                    }
                  }
                } catch (readError: any) {
                  // Ignorar erros de leitura silenciosamente (característica pode não ter dados)
                }
              }
            }
          } catch (err: any) {
            // Ignorar erros de serviço
          }
        }
      } catch (error: any) {
        // Ignorar erros gerais
      }
    }, 1000); // Ler a cada 1 segundo

    // Armazenar o intervalo para limpar depois
    (device as any)._readInterval = readInterval;
    addLog('Leitura periódica iniciada');
  };

  const disconnectDevice = async (deviceItem: DeviceItem) => {
    try {
      addLog(`Desconectando de ${deviceItem.name || deviceItem.id}...`);
      
      // Parar monitoramento
      monitoringSubscriptionsRef.current.forEach(sub => {
        try {
          sub.remove();
        } catch {}
      });
      monitoringSubscriptionsRef.current = [];
      setMonitoringSubscriptions([]);

      // Limpar leitura periódica se existir
      if (connectedDevice && (connectedDevice as any)._readInterval) {
        clearInterval((connectedDevice as any)._readInterval);
      }

      await deviceItem.device.cancelConnection();
      addLog(`Desconectado de ${deviceItem.name || deviceItem.id}`);
      setDevices(prev =>
        prev.map(d => (d.id === deviceItem.id ? { ...d, isConnected: false } : d)),
      );
      setConnectedDevice(null);
      setReceivedData([]);
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
          <Text style={styles.deviceName}>{item.name || 'Dispositivo Desconhecido'}</Text>
          <Text style={styles.deviceId}>ID: {item.id}</Text>
          <Text style={styles.deviceRssi}>RSSI: {item.rssi !== null ? `${item.rssi} dBm` : 'N/A'}</Text>
          {item.isConnected && <Text style={styles.connectedLabel}>● Conectado</Text>}
        </View>
        <View style={styles.deviceActions}>
          {item.isConnected ? (
            <TouchableOpacity style={styles.disconnectButton} onPress={() => disconnectDevice(item)}>
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
            <Text style={[styles.enableButtonText, bluetoothEnabled && styles.enableButtonTextActive]}>
              {bluetoothEnabled ? 'Bluetooth Habilitado' : 'Habilitar Bluetooth'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={startScan}
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

        <Text style={styles.sectionTitle}>Dispositivos Encontrados ({devices.length})</Text>

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
            <Text style={styles.sectionTitle}>Dados Recebidos ({receivedData.length})</Text>
            <ScrollView style={styles.logsScroll}>
              {receivedData.map((data, index) => (
                <Text key={index} style={[styles.logText, styles.dataText]}>
                  {data}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.logsContainer}>
          <View style={styles.logsHeader}>
            <Text style={styles.sectionTitle}>Logs ({logs.length})</Text>
            <TouchableOpacity
              style={styles.openModalButton}
              onPress={() => setLogsModalVisible(true)}
            >
              <Text style={styles.openModalButtonText}>Abrir em Tela Cheia</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.logsScroll}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))}
            {logs.length === 0 && <Text style={styles.emptyText}>Nenhum log ainda</Text>}
          </ScrollView>
        </View>

        {/* Modal de Logs em Tela Cheia */}
        <Modal
          visible={logsModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setLogsModalVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Logs do Bluetooth ({logs.length})</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setLogsModalVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalLogsScroll}>
              {logs.map((log, index) => (
                <Text key={index} style={styles.modalLogText}>
                  {log}
                </Text>
              ))}
              {logs.length === 0 && (
                <Text style={styles.modalEmptyText}>Nenhum log ainda</Text>
              )}
            </ScrollView>
            {receivedData.length > 0 && (
              <View style={styles.modalDataSection}>
                <Text style={styles.modalSectionTitle}>
                  Dados Recebidos ({receivedData.length})
                </Text>
                <ScrollView style={styles.modalDataScroll}>
                  {receivedData.map((data, index) => (
                    <Text key={index} style={[styles.modalLogText, styles.modalDataText]}>
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
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing.sm, color: colors.textDark },
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
  deviceName: { fontSize: 16, fontWeight: '600', color: colors.textDark, marginBottom: spacing.xs },
  deviceId: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  deviceRssi: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  connectedLabel: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: spacing.xs },
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
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.md, fontStyle: 'italic' },
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
  logsScroll: { backgroundColor: colors.white, borderRadius: 12, padding: spacing.sm, maxHeight: 150 },
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
  // Estilos da Modal
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
