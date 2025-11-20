// HomeWip.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Linking,
} from 'react-native';
import type { Permission } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import type {
  Device,
  BleError,
  State as BleState,
  Subscription,
} from 'react-native-ble-plx';
import { useNavigationLogger } from '@services/logging';
import Logo from '@assets/lampinpuntologo.svg';
import { BottomBar } from '@/ui/BottomBar';
import { HomeHeader } from '../components/HomeHeader';
import { colors } from '@presentation/theme';
import { PopUpRequestBluetooth } from '../components/PopUpRequestBluetooth';
import type { BluetoothDevice } from '@services/bluetooth/types';

// IntentLauncher removido - usando react-native-intent-launcher ou Linking diretamente

interface Props {
  userName: string;
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;
  onStartTest: () => void;
  onTutorial?: () => void;
  onNavigateToBluetooth?: () => void;
}

export const HomeWip: React.FC<Props> = ({
  userName,
  onBack,
  onGoHome,
  onOpenHistory,
  onStartTest,
  onTutorial,
  onNavigateToBluetooth,
}) => {
  const { logUserAction } = useNavigationLogger({
    screenName: 'HomeWip',
    additionalContext: { userName, hasBackAction: !!onBack },
  });

  const [isBluetoothPopupVisible, setBluetoothPopupVisible] = useState(false);
  const hasInitialPopupShownRef = useRef(false);
  const [bluetoothPopupMode, setBluetoothPopupMode] = useState<
    'request' | 'error' | 'devices'
  >('request');
  const [isRequestingBluetooth, setIsRequestingBluetooth] = useState(false);
  const [hasOpenedBluetoothSettings, setHasOpenedBluetoothSettings] =
    useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>(
    []
  );
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
    null
  );
  const [connectedDevice, setConnectedDevice] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [bluetoothInfoMessage, setBluetoothInfoMessage] = useState<
    string | null
  >(null);
  const [bluetoothErrorMessage, setBluetoothErrorMessage] = useState<
    string | null
  >(null);
  const [bleManagerAvailable, setBleManagerAvailable] = useState(true);
  const [bleManagerInitChecked, setBleManagerInitChecked] = useState(false);

  const bleManagerRef = useRef<BleManager | null>(null);
  const scanStopRef = useRef<(() => void) | null>(null);
  const devicesMapRef = useRef(new Map<string, BluetoothDevice>());
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isScanningRef = useRef(false);
  const scanStartAttemptRef = useRef(false);

  const androidVersion =
    Platform.OS === 'android'
      ? typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(Platform.Version, 10)
      : null;

  useEffect(() => {
    isMountedRef.current = true;
    hasInitialPopupShownRef.current = false;
    
    try {
      const manager = new BleManager();
      bleManagerRef.current = manager;
      setBleManagerAvailable(true);
      logUserAction('bluetooth_manager_initialized');
    } catch (error) {
      bleManagerRef.current = null;
      setBleManagerAvailable(false);
      setBluetoothErrorMessage(
        'O módulo de Bluetooth não está disponível neste ambiente. Utilize uma build com suporte a BLE para continuar.'
      );
      setBluetoothPopupMode('error');
      setBluetoothPopupVisible(true);
      hasInitialPopupShownRef.current = true;
      logUserAction('bluetooth_manager_init_failed', {
        message: (error as Error).message,
      });
    }

    setBleManagerInitChecked(true);

    // Mostrar popup automaticamente após inicializar (apenas uma vez)
    // Só mostrar se o popup ainda não estiver visível ou se não foi mostrado antes
    const showPopupTimer = setTimeout(() => {
      // Verificar se ainda deve mostrar o popup inicial
      // Não mostrar se:
      // 1. Componente foi desmontado
      // 2. Popup inicial já foi mostrado/interagido
      // 3. Popup já está visível (pode estar em outro modo)
      if (isMountedRef.current && !hasInitialPopupShownRef.current && !isBluetoothPopupVisible) {
        // Verificar o modo atual antes de definir
        setBluetoothPopupMode(currentMode => {
          // Se o popup já estiver em modo 'devices' ou 'error', não resetar
          if (currentMode === 'devices' || currentMode === 'error') {
            hasInitialPopupShownRef.current = true;
            return currentMode;
          }
          // Caso contrário, definir como 'request'
          hasInitialPopupShownRef.current = true;
          logUserAction('bluetooth_permission_popup_shown_on_init');
          return 'request';
        });
        setBluetoothErrorMessage(null);
        setBluetoothInfoMessage(null);
        setBluetoothPopupVisible(true);
      }
    }, 800);

    return () => {
      clearTimeout(showPopupTimer);
      isMountedRef.current = false;
      hasInitialPopupShownRef.current = false;
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      if (scanStopRef.current) {
        scanStopRef.current();
        scanStopRef.current = null;
      }
      // Destruir serviços
      // bleManagerRef.current?.destroy(); -> se destruir aqui o bluetooth nao se mantem aberto e buga o acesso.
      bleManagerRef.current = null;
    };
  }, [logUserAction]);


  // ensureIntentLauncherLoaded removido - usando react-native-intent-launcher ou Linking diretamente

  const handleBack = () => {
    logUserAction('back_button_pressed', { action: 'navigate_back' });
    onBack?.();
  };

  const handleGoHome = () => {
    logUserAction('home_button_pressed', { action: 'navigate_home' });
    onGoHome?.();
  };

  const handleOpenHistory = () => {
    logUserAction('history_button_pressed', { action: 'open_history' });
    onOpenHistory?.();
  };

  const handleStartTest = () => {
    logUserAction('start_test_button_pressed', { action: 'start_test' });
    onStartTest();
  };

  const cleanupScan = useCallback(() => {
    if (scanStopRef.current) {
      scanStopRef.current();
      scanStopRef.current = null;
    }
    if (isMountedRef.current) {
      setIsScanningDevices(false);
    }
  }, []);

  // Monitorar estado do Bluetooth (igual ao app de referência)
  useEffect(() => {
    if (!bleManagerRef.current) {
      return;
    }

    const manager = bleManagerRef.current;
    const subscription = manager.onStateChange((state: BleState) => {
      if (state === 'PoweredOff') {
        // Parar scan se o Bluetooth for desligado
        setIsScanningDevices(false);
        cleanupScan();
        if (isMountedRef.current) {
          setBluetoothErrorMessage(
            'Bluetooth desligado. Por favor, ligue o Bluetooth e tente novamente.'
          );
          setBluetoothPopupMode('error');
        }
      }
    }, true);

    return () => {
      subscription.remove();
    };
  }, [cleanupScan]);

  const checkBluetoothPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if ((androidVersion ?? 0) >= 31) {
        const [connectGranted, scanGranted] = await Promise.all([
          PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          ),
          PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
          ),
        ]);

        return connectGranted && scanGranted;
      }

      const locationGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return locationGranted;
    } catch (error) {
      logUserAction('bluetooth_permission_check_failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }, [androidVersion, logUserAction]);

  const requestBluetoothPermissions =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== 'android') {
        return true;
      }

      try {
        if ((androidVersion ?? 0) >= 31) {
          const permissions: Permission[] = [];

          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          }

          if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
            permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          }

          const result = await PermissionsAndroid.requestMultiple(permissions);

          const granted = Object.values(result).every(
            value => value === PermissionsAndroid.RESULTS.GRANTED
          );

          if (!granted) {
            logUserAction('bluetooth_permission_denied', { result });
          }

          return granted;
        }

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permissão necessária',
            message:
              'Precisamos da sua permissão para acessar o Bluetooth e conectar ao equipamento.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Cancelar',
          }
        );

        const granted = result === PermissionsAndroid.RESULTS.GRANTED;

        if (!granted) {
          logUserAction('bluetooth_permission_denied', { result });
        }

        return granted;
      } catch (error) {
        logUserAction('bluetooth_permission_request_failed', {
          error: (error as Error).message,
        });
        return false;
      }
    }, [androidVersion, logUserAction]);

  const openSystemBluetoothSettings = useCallback(async () => {
    if (hasOpenedBluetoothSettings) {
      return;
    }

    const markAsOpened = () => {
      setHasOpenedBluetoothSettings(true);
    };

    try {
      if (Platform.OS === 'android') {
        // Tentar abrir Bluetooth Settings diretamente usando react-native-intent-launcher ou Linking
        try {
          // Tentar usar react-native-intent-launcher se disponível
          const IntentLauncher = require('react-native-intent-launcher');
          if (IntentLauncher && IntentLauncher.default) {
            await IntentLauncher.default.startActivity({
              action: 'android.settings.BLUETOOTH_SETTINGS',
            });
            logUserAction('bluetooth_settings_opened', {
              platform: Platform.OS,
              method: 'intent-launcher',
            });
            markAsOpened();
            return;
          }
        } catch (intentError) {
          // Intent launcher não disponível, continuar com Linking
          console.warn('Intent launcher não disponível, usando Linking:', intentError);
        }

        // Fallback: tentar abrir via intent URI
        try {
          const intentURI = `intent://settings/bluetooth#Intent;scheme=android.settings;end`;
          const canOpen = await Linking.canOpenURL(intentURI);
          if (canOpen) {
            await Linking.openURL(intentURI);
            logUserAction('bluetooth_settings_opened', {
              platform: Platform.OS,
              method: 'intent-uri',
            });
            markAsOpened();
            return;
          }
        } catch (uriError) {
          // Continuar para fallback genérico
          console.warn('Não foi possível abrir via intent URI:', uriError);
        }
      } else if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:Bluetooth');
        logUserAction('bluetooth_settings_opened', {
          platform: Platform.OS,
        });
        markAsOpened();
        return;
      }

      // Fallback genérico: abrir configurações gerais
      await Linking.openSettings();
      logUserAction('bluetooth_settings_opened', {
        platform: Platform.OS,
        fallback: true,
      });
      markAsOpened();
    } catch (error) {
      logUserAction('bluetooth_settings_open_failed', {
        error: (error as Error).message,
      });
      try {
        await Linking.openSettings();
        logUserAction('bluetooth_settings_opened', {
          platform: Platform.OS,
          fallback: true,
          viaCatch: true,
        });
        markAsOpened();
      } catch (fallbackError) {
        logUserAction('bluetooth_settings_open_failed', {
          error: (fallbackError as Error).message,
          stage: 'fallback',
        });
      }
    }
  }, [hasOpenedBluetoothSettings, logUserAction]);

  const startBluetoothScan = useCallback(
    async (options?: { autoOpenSettingsOnPowerOff?: boolean }) => {
      // Verificações básicas
      if (!bleManagerAvailable || !bleManagerRef.current) {
        setBluetoothErrorMessage(
          'O módulo de Bluetooth não está disponível neste ambiente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      // Se já estiver escaneando, parar (igual ao app de referência)
      if (isScanningRef.current) {
        cleanupScan();
        setIsScanningDevices(false);
        return;
      }

      // Verificar permissões
      const hasPermissions = await checkBluetoothPermissions();
      if (!hasPermissions) {
        setBluetoothErrorMessage(
          'Permissões Bluetooth não concedidas. Por favor, conceda as permissões necessárias.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      const manager = bleManagerRef.current;

      // Verificar estado do Bluetooth
      try {
        const state = await manager.state();
        if (state === 'PoweredOff') {
          setIsScanningDevices(false);
          setBluetoothErrorMessage(
            'Bluetooth desligado. Por favor, ligue o Bluetooth e tente novamente.'
          );
          setBluetoothPopupMode('error');
          setBluetoothPopupVisible(true);
          if (options?.autoOpenSettingsOnPowerOff) {
            await openSystemBluetoothSettings();
          }
          return;
        }
      } catch (error) {
        setIsScanningDevices(false);
        setBluetoothErrorMessage(
          'Erro ao verificar estado do Bluetooth.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      // Parar scan anterior se houver
      cleanupScan();
      
      // Limpar dispositivos e iniciar scan (igual ao app de referência)
      devicesMapRef.current.clear();
      setBluetoothDevices([]);
      setIsScanningDevices(true);
      setBluetoothInfoMessage('Buscando dispositivos...');
      setBluetoothErrorMessage(null);
      setBluetoothPopupMode('devices');
      setBluetoothPopupVisible(true);

      // Função para parar scan
      const stopScan = () => {
        isScanningRef.current = false;
        try {
          manager.stopDeviceScan();
        } catch (error) {
          // Ignorar erros ao parar scan
        }
        setIsScanningDevices(false);
      };

      scanStopRef.current = stopScan;
      isScanningRef.current = true;

      // Iniciar scan (igual ao app de referência - simples e direto)
      try {
        manager.startDeviceScan(null, null, (error: BleError | null, device: Device | null) => {
          // Verificar se ainda estamos escaneando antes de processar
          if (!isScanningRef.current) {
            return;
          }

          if (error) {
            // Erro no scan - parar e mostrar mensagem
            // Capturar erros específicos e tratar adequadamente
            const errorMessage = error.message || 'Erro ao buscar dispositivos Bluetooth.';
            
            // Ignorar erros comuns que não são críticos
            if (error.errorCode === 600 && error.message?.includes('Unknown error')) {
              // Erro desconhecido comum - logar mas não bloquear completamente
              console.warn('BleError desconhecido capturado:', error);
              // Não parar o scan completamente, apenas logar
              return;
            }

            // Outros erros - parar o scan
            stopScan();
            if (isMountedRef.current) {
              setBluetoothErrorMessage(errorMessage);
              setBluetoothPopupMode('error');
            }
            return;
          }

          if (device && device.id && isMountedRef.current) {
            // Adicionar/atualizar dispositivo na lista (igual ao app de referência)
            const name = device.name?.trim() || 
                        device.localName?.trim() || 
                        'Equipamento sem nome';
            
            const bluetoothDevice: BluetoothDevice = {
              id: device.id,
              name,
              rssi: device.rssi,
              type: 'ble',
            };

            // Atualizar mapa e lista (igual ao app de referência)
            devicesMapRef.current.set(bluetoothDevice.id, bluetoothDevice);

            // Atualizar lista ordenada
            setBluetoothDevices(
              Array.from(devicesMapRef.current.values()).sort((a, b) =>
                a.name.localeCompare(b.name)
              )
            );
          }
        });
      } catch (error: any) {
        stopScan();
        const errorMessage = error?.message || 'Erro ao iniciar busca de dispositivos Bluetooth.';
        if (isMountedRef.current) {
          setBluetoothErrorMessage(errorMessage);
          setBluetoothPopupMode('error');
        }
        console.error('Erro ao iniciar scan:', error);
      }
    },
    [
      bleManagerAvailable,
      cleanupScan,
      checkBluetoothPermissions,
      openSystemBluetoothSettings,
      logUserAction,
    ]
  );

  const handleOpenBluetoothPopup = useCallback(() => {
    setBluetoothPopupVisible(true);
    setBluetoothPopupMode('request');
    logUserAction('bluetooth_permission_popup_shown');
  }, [logUserAction]);

  const handleOpenBluetoothFromHeader = useCallback(() => {
    logUserAction('bluetooth_header_button_pressed', {
      action: 'navigate_to_bluetooth_screen',
    });

    if (onNavigateToBluetooth) {
      onNavigateToBluetooth();
    }
  }, [onNavigateToBluetooth, logUserAction]);


  const handleBluetoothPermission = useCallback(async () => {
    if (isRequestingBluetooth) {
      return;
    }

    // Marcar que o popup inicial já foi interagido para evitar que o timer o reset
    hasInitialPopupShownRef.current = true;
    setIsRequestingBluetooth(true);

    const granted = await requestBluetoothPermissions();

    if (granted) {
      logUserAction('bluetooth_permission_granted');
      setIsRequestingBluetooth(false);
      
      if (bleManagerAvailable) {
        // Iniciar scan que já define o modo como 'devices' automaticamente
        await startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
      } else {
        setBluetoothErrorMessage(
          'O módulo de Bluetooth não está disponível neste ambiente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
      }
      return;
    }

    logUserAction('bluetooth_permission_not_granted');
    setBluetoothPopupMode('error');
    setIsRequestingBluetooth(false);
  }, [
    bleManagerAvailable,
    isRequestingBluetooth,
    startBluetoothScan,
    requestBluetoothPermissions,
    logUserAction,
  ]);

  const handleRetryBluetoothPermission = useCallback(async () => {
    setBluetoothErrorMessage(null);
    if (isRequestingBluetooth) {
      return;
    }
    const granted = await checkBluetoothPermissions();
    if (granted) {
      await startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
    } else {
      setBluetoothPopupMode('request');
    }
  }, [
    checkBluetoothPermissions,
    isRequestingBluetooth,
    bleManagerAvailable,
    startBluetoothScan,
  ]);

  const handleCloseBluetoothPopup = useCallback(() => {
    if (isRequestingBluetooth || connectingDeviceId) {
      return;
    }
    cleanupScan();
    setBluetoothPopupVisible(false);
    setBluetoothPopupMode('request');
    setBluetoothInfoMessage(null);
    setBluetoothErrorMessage(null);
  }, [cleanupScan, connectingDeviceId, isRequestingBluetooth]);

  const handleRefreshDeviceList = useCallback(() => {
    if (connectingDeviceId) {
      return;
    }
    
    // Limpar lista e mensagens imediatamente (similar ao appblefodaum)
    setBluetoothDevices([]);
    setBluetoothInfoMessage(null);
    setBluetoothErrorMessage(null);
    
    // Limpar mapa de dispositivos para começar do zero
    devicesMapRef.current.clear();
    
    // Parar qualquer scan em andamento antes de iniciar um novo
    if (scanStopRef.current) {
      scanStopRef.current();
      scanStopRef.current = null;
    }
    
    // Pequeno delay para garantir que o scan anterior foi parado
    setTimeout(() => {
      void startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
    }, 100);
  }, [connectingDeviceId, startBluetoothScan]);

  const handleSelectBluetoothDevice = useCallback(
    async (deviceId: string) => {
      // Encontrar o dispositivo na lista para saber o tipo
      const device = devicesMapRef.current.get(deviceId);
      if (!device) {
        setBluetoothErrorMessage('Dispositivo não encontrado.');
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      if (connectingDeviceId) {
        return;
      }

      cleanupScan();
      setConnectingDeviceId(deviceId);
      setBluetoothInfoMessage('Conectando ao equipamento...');
      setBluetoothErrorMessage(null);
      logUserAction('bluetooth_device_connection_started', {
        deviceId,
        deviceType: device.type,
      });

      try {
        // Conectar via BLE
        const manager = bleManagerRef.current;
        if (!bleManagerAvailable || !manager) {
          throw new Error(
            'O módulo de Bluetooth não está disponível neste ambiente.'
          );
        }

        const bleDevice = await manager.connectToDevice(deviceId, {
          timeout: 15000,
        });
        await bleDevice.discoverAllServicesAndCharacteristics();

        if (!isMountedRef.current) {
          return;
        }

        const deviceName =
          bleDevice.name?.trim() ||
          bleDevice.localName?.trim() ||
          'Equipamento';

        setConnectedDevice({ id: bleDevice.id, name: deviceName });
        setBluetoothInfoMessage('Equipamento conectado com sucesso!');
        logUserAction('bluetooth_ble_device_connected', {
          deviceId: bleDevice.id,
          deviceName,
        });

        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) {
            return;
          }
          setBluetoothPopupVisible(false);
          setBluetoothPopupMode('devices');
          setBluetoothInfoMessage(null);
        }, 1200);
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        logUserAction('bluetooth_device_connection_failed', {
          deviceId,
          deviceType: device.type,
          message: (error as Error).message,
        });
        setBluetoothErrorMessage(
          'Não foi possível conectar ao equipamento. Verifique se ele está ligado e tente novamente.'
        );
        setBluetoothPopupMode('devices');
        setBluetoothPopupVisible(true);
        await startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
      } finally {
        if (isMountedRef.current) {
          setConnectingDeviceId(null);
        }
      }
    },
    [
      bleManagerAvailable,
      cleanupScan,
      connectingDeviceId,
      logUserAction,
      startBluetoothScan,
    ]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* ==== HEADER ==== */}
        <HomeHeader
          {...(onBack && { onBack: handleBack })}
          onGoHome={handleGoHome}
          onOpenHistory={handleOpenHistory}
          onOpenBluetooth={handleOpenBluetoothFromHeader}
          showBackButton={!!onBack}
          showHomeButton={true}
          showHistoryButton={true}
          showBluetoothButton={true}
        />

        {/* ==== LOGO ==== */}
        <View style={styles.logoWrap}>
          <Logo width={160} height={160} />
        </View>

        {/* ==== TEXTO CENTRAL ==== */}
        <View style={styles.centerText}>
          <Text style={styles.welcome}>
            Bem-vindo(a), <Text style={styles.welcomeBold}>{userName}!</Text>
          </Text>

          {/* separador */}
          <View style={styles.divider} />

          <Text style={styles.question}>Vamos começar?</Text>
          <Text style={styles.helper}>
            Toque no botão{'\n'}abaixo para iniciar.
          </Text>

          {connectedDevice && (
            <View style={styles.connectionBanner}>
              <Text style={styles.connectionLabel}>Equipamento conectado:</Text>
              <Text style={styles.connectionName}>{connectedDevice.name}</Text>
            </View>
          )}
        </View>

        {/* ==== BOTÃO PRINCIPAL ==== */}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleStartTest}>
          <Text style={styles.primaryBtnText}>Iniciar</Text>
        </TouchableOpacity>

        {/* ==== BARRA INFERIOR ==== */}
        <BottomBar fixed={true} />
      </View>

      <PopUpRequestBluetooth
        visible={isBluetoothPopupVisible}
        mode={bluetoothPopupMode}
        loading={isRequestingBluetooth || !!connectingDeviceId}
        devices={bluetoothDevices}
        scanning={isScanningDevices}
        connectingDeviceId={connectingDeviceId}
        infoMessage={bluetoothInfoMessage}
        errorMessage={bluetoothErrorMessage}
        onSelectDevice={deviceId => {
          void handleSelectBluetoothDevice(deviceId);
        }}
        onRefresh={handleRefreshDeviceList}
        onPrimary={
          bluetoothPopupMode === 'error'
            ? () => {
                void handleRetryBluetoothPermission();
              }
            : () => {
                void handleBluetoothPermission();
              }
        }
        onClose={handleCloseBluetoothPopup}
      />
    </SafeAreaView>
  );
};

/* ================== styles ================== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundGrayAlt2 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
  },
  headerRight: { flexDirection: 'row', gap: 12 },
  headerBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },

  /* LOGO */
  logoWrap: {
    alignItems: 'center',
    marginTop: 32,
  },
  logoPlaceholder: {
    width: 160,
    height: 160,
    backgroundColor: colors.gold,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: colors.white,
    fontSize: 40,
    fontWeight: 'bold',
  },

  /* TEXTOS CENTRAIS */
  centerText: {
    alignItems: 'center',
    marginTop: 16,
  },
  welcome: { fontSize: 20, color: colors.textMuted, textAlign: 'center' },
  welcomeBold: { color: colors.gold, fontWeight: '700' },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.gold,
    marginVertical: 16,
  },
  question: { fontSize: 18, fontWeight: '700', color: colors.gold },
  helper: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  connectionBanner: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.goldBackgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
  },
  connectionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  connectionName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.goldDark,
  },

  /* BOTÃO */
  primaryBtn: {
    marginTop: 24,
    marginBottom: 70,
    marginHorizontal: 32,
    backgroundColor: colors.gold,
    borderRadius: 28,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
