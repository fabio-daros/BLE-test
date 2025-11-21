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
import { useBluetooth } from '@/contexts/BluetoothContext';

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

  // Usar contexto Bluetooth
  const {
    connectedDevice,
    setConnectedDevice,
    isConnecting,
    setConnecting,
    bleManager: contextBleManager,
    bleManagerAvailable: contextBleManagerAvailable,
    hasConnectedDevice,
  } = useBluetooth();

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
  const [bluetoothInfoMessage, setBluetoothInfoMessage] = useState<
    string | null
  >(null);
  const [bluetoothErrorMessage, setBluetoothErrorMessage] = useState<
    string | null
  >(null);
  const [bleManagerInitChecked, setBleManagerInitChecked] = useState(false);

  // Usar o BleManager do contexto, mas manter ref local para compatibilidade
  const bleManagerRef = useRef<BleManager | null>(contextBleManager || null);
  const scanStopRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devicesMapRef = useRef(new Map<string, BluetoothDevice>());
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bluetoothStateSubscriptionRef = useRef<Subscription | null>(null);
  const isMountedRef = useRef(true);
  const isScanningRef = useRef(false);
  const scanStartAttemptRef = useRef(false);

  const androidVersion =
    Platform.OS === 'android'
      ? typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(Platform.Version, 10)
      : null;

  // Atualizar bleManagerRef sempre que contextBleManager mudar
  useEffect(() => {
    if (contextBleManager) {
      bleManagerRef.current = contextBleManager;
    }
  }, [contextBleManager]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // IMPORTANTE: Não resetar hasInitialPopupShownRef se já houver dispositivo conectado
    // Isso evita que o popup apareça novamente quando o usuário volta para a tela
    if (hasConnectedDevice()) {
      // Se há dispositivo conectado no contexto, não mostrar popup
      hasInitialPopupShownRef.current = true;
    } else {
      hasInitialPopupShownRef.current = false;
    }

    setBleManagerInitChecked(true);

    // Mostrar popup automaticamente após inicializar (apenas uma vez)
    // Só mostrar se o popup ainda não estiver visível ou se não foi mostrado antes
    // CRÍTICO: NUNCA mostrar o popup se já houver um dispositivo conectado
    const showPopupTimer = setTimeout(() => {
      // Verificar se ainda deve mostrar o popup inicial
      // Não mostrar se:
      // 1. Componente foi desmontado
      // 2. Popup inicial já foi mostrado/interagido
      // 3. Popup já está visível (pode estar em outro modo)
      // 4. Há um dispositivo conectado (NUNCA mostrar popup inicial se já estiver conectado)
      if (
        isMountedRef.current &&
        !hasInitialPopupShownRef.current &&
        !isBluetoothPopupVisible &&
        !hasConnectedDevice() // CRÍTICO: Não mostrar popup inicial se já houver dispositivo conectado no contexto
      ) {
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
      
      // IMPORTANTE: Só limpar successTimeoutRef no unmount real do componente,
      // não quando o useEffect roda novamente devido a mudanças de estado
      // O successTimeoutRef só deve ser limpo quando o componente for desmontado
      // ou quando for explicitamente cancelado (ex: nova conexão)
      
      // Remover listener de estado do Bluetooth (igual ao BluetoothConnectionScreen)
      try {
        if (bluetoothStateSubscriptionRef.current) {
          bluetoothStateSubscriptionRef.current.remove();
          bluetoothStateSubscriptionRef.current = null;
        }
      } catch (e: any) {
        console.warn('[BLE] Erro ao remover subscription:', e);
      }
      
      // Parar scan no unmount (igual ao BluetoothConnectionScreen)
      try {
        if (bleManagerRef.current) {
          bleManagerRef.current.stopDeviceScan();
        }
      } catch {
        // ignora
      }
      
      // Limpar timeouts de scan (mas não successTimeoutRef aqui)
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      
      if (scanStopRef.current) {
        scanStopRef.current = null;
      }
      
      // Só limpar successTimeoutRef e marcar como desmontado no unmount real
      // Isso é feito em um useEffect separado com dependências vazias []
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBluetoothPopupVisible, logUserAction, connectedDevice, hasConnectedDevice, contextBleManager]);

  // useEffect separado para cleanup apenas no unmount real
  useEffect(() => {
    return () => {
      console.log('[BLE] Componente desmontando, limpando tudo...');
      isMountedRef.current = false;
      hasInitialPopupShownRef.current = false;
      
      // Limpar timeout de sucesso apenas no unmount real
      if (successTimeoutRef.current) {
        console.log('[BLE] Limpando successTimeoutRef no unmount');
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, []); // Array vazio = apenas no mount/unmount


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
    console.log('[BLE] ===== cleanupScan chamado =====');
    console.log('[BLE] Stack trace:', new Error().stack);
    console.log('[BLE] isScanningRef.current:', isScanningRef.current);
    console.log('[BLE] scanStopRef.current existe:', !!scanStopRef.current);
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    // Só chamar stopScan se realmente estiver escaneando
    if (isScanningRef.current && scanStopRef.current) {
      console.log('[BLE] Chamando stopScan via cleanupScan');
      scanStopRef.current();
      scanStopRef.current = null;
    } else if (scanStopRef.current) {
      // Limpar ref mesmo se não estiver escaneando
      scanStopRef.current = null;
    }
    if (isMountedRef.current) {
      setIsScanningDevices(false);
      isScanningRef.current = false;
    }
  }, []);

  // Monitorar estado do Bluetooth - será registrado após conceder permissão
  // O listener será registrado no handleBluetoothPermission

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
      // Verificações básicas - usar contextBleManager diretamente
      const manager = contextBleManager || bleManagerRef.current;
      if (!contextBleManagerAvailable || !manager) {
        setBluetoothErrorMessage(
          'O módulo de Bluetooth não está disponível neste ambiente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
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

      // Verificar estado do Bluetooth
      try {
        const state = await manager.state();
        console.log('[BLE] Estado atual do Bluetooth:', state);
        logUserAction('bluetooth_state_checked', { state });
        
        if (state === 'PoweredOff') {
          console.log('[BLE] Bluetooth desligado, não é possível escanear');
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
        
        if (state !== 'PoweredOn') {
          console.log('[BLE] Bluetooth não está pronto, estado:', state);
          setIsScanningDevices(false);
          setBluetoothErrorMessage(
            `Bluetooth não está pronto. Estado: ${state}`
          );
          setBluetoothPopupMode('error');
          setBluetoothPopupVisible(true);
          return;
        }
      } catch (error: any) {
        console.error('[BLE] Erro ao verificar estado do Bluetooth:', error);
        setIsScanningDevices(false);
        setBluetoothErrorMessage(
          `Erro ao verificar estado do Bluetooth: ${error?.message || 'Erro desconhecido'}`
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      // Limpar dispositivos e iniciar scan (igual ao BluetoothConnectionScreen linha 575-610)
      const currentlyConnected = connectedDevice; // Do contexto
      if (!currentlyConnected) {
        // Se não tiver nada conectado, limpar tudo
        devicesMapRef.current.clear();
        setBluetoothDevices([]);
      } else {
        // Garantir que o dispositivo conectado esteja na lista (igual ao BluetoothConnectionScreen linha 582-609)
        setBluetoothDevices(prev => {
          const exists = prev.find(d => d.id === currentlyConnected.id);
          if (exists) {
            return prev.map(d =>
              d.id === currentlyConnected.id
                ? { ...d }
                : d
            );
          }
          return [
            {
              id: currentlyConnected.id,
              name: currentlyConnected.name,
              rssi: null,
              type: 'ble' as const,
            },
            ...prev,
          ];
        });
      }

      // Definir estado de scanning ANTES de iniciar o scan (igual ao BluetoothConnectionScreen linha 612)
      setIsScanningDevices(true);
      isScanningRef.current = true;
      setBluetoothInfoMessage('Buscando dispositivos...');
      setBluetoothErrorMessage(null);
      setBluetoothPopupMode('devices');
      setBluetoothPopupVisible(true);

      // Garantir que não exista timeout antigo pendurado (igual ao BluetoothConnectionScreen linha 615-619)
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      // Timeout automático do scan (10 segundos, igual ao BluetoothConnectionScreen linha 621-635)
      scanTimeoutRef.current = setTimeout(() => {
        try {
          manager.stopDeviceScan();
          console.log('[BLE] Scan parado automaticamente por timeout (10s).');
        } catch (e: any) {
          console.warn(`[BLE] Erro ao parar scan no timeout: ${e?.message || String(e)}`);
        }

        if (isMountedRef.current) {
          setIsScanningDevices(false);
          isScanningRef.current = false;
        }

        scanTimeoutRef.current = null;
      }, 10000); // 10.000 ms = 10s

      // Iniciar scan (exatamente igual ao BluetoothConnectionScreen linha 637-691)
      try {
        console.log('[BLE] Iniciando scan de dispositivos...');
        console.log('[BLE] Manager:', manager ? 'OK' : 'NULL');
        logUserAction('bluetooth_scan_starting', {});
        
        // IMPORTANTE: garantir que não há scan anterior ativo antes de iniciar novo
        try {
          manager.stopDeviceScan();
          console.log('[BLE] Parando qualquer scan anterior antes de iniciar novo');
          // Pequeno delay para garantir que o scan anterior foi parado
          await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
        } catch (e) {
          // Ignorar se não houver scan ativo
        }
        
        // Usar exatamente os mesmos parâmetros do BluetoothConnectionScreen
        manager.startDeviceScan(null, null, (error, device) => {
          // Log para debug - verificar se o callback está sendo chamado
          console.log('[BLE] === CALLBACK CHAMADO ===', 'error:', error ? 'SIM' : 'NÃO', 'device:', device ? 'SIM' : 'NÃO');
          
          if (error) {
            const msg = (error as any)?.message || 'Erro desconhecido';
            const code = (error as any)?.errorCode || 'N/A';
            const reason = (error as any)?.reason || 'N/A';
            
            console.error('[BLE] ERRO no scan:', msg);
            console.error('[BLE] Código:', code, 'Razão:', reason);
            logUserAction('bluetooth_scan_error', { 
              message: msg, 
              code: String(code),
              reason: String(reason)
            });
            
            if (isMountedRef.current) {
              setIsScanningDevices(false);
              setBluetoothErrorMessage(`Erro ao buscar dispositivos: ${msg}`);
              setBluetoothPopupMode('error');
            }

            // Em caso de erro, limpa timeout e para scan (igual ao BluetoothConnectionScreen linha 646-653)
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current);
              scanTimeoutRef.current = null;
            }
            try {
              manager.stopDeviceScan();
            } catch { }
            
            // Parar o scan ref
            isScanningRef.current = false;
            return;
          }

          // Log para debug - verificar se o callback está sendo chamado
          console.log('[BLE] CALLBACK CHAMADO - device:', device ? 'presente' : 'null', 'error:', error ? 'presente' : 'null');
          
          if (!device || !isMountedRef.current) {
            if (!device) {
              console.log('[BLE] Device é null, retornando');
            }
            if (!isMountedRef.current) {
              console.log('[BLE] Componente não está montado, retornando');
            }
            return;
          }

          // Filtrar apenas dispositivos que contenham "InPunto" no nome (igual ao BluetoothConnectionScreen linha 661-664)
          const name = (device.name || '').trim();
          console.log('[BLE] Dispositivo encontrado no scan:', name || '(sem nome)', 'ID:', device.id, 'RSSI:', device.rssi);
          
          if (!name.includes('InPunto')) {
            console.log('[BLE] Dispositivo não contém "InPunto" no nome, ignorando:', name);
            return;
          }

          console.log('[BLE] Dispositivo InPunto encontrado:', name, 'ID:', device.id, 'RSSI:', device.rssi);
          logUserAction('bluetooth_device_found', { 
            deviceId: device.id,
            deviceName: name,
            rssi: device.rssi
          });

          // Atualizar lista diretamente (igual ao BluetoothConnectionScreen linha 666-690)
          setBluetoothDevices(prev => {
            const idx = prev.findIndex(d => d.id === device.id);
            if (idx >= 0) {
              // Atualizar dispositivo existente (igual ao BluetoothConnectionScreen linha 668-678)
              const updated = [...prev];
              const existing = updated[idx];
              updated[idx] = {
                id: device.id,
                name: device.name || 'Equipamento sem nome',
                rssi: device.rssi ?? null,
                type: 'ble' as const,
                ...(existing?.address && { address: existing.address }),
              };
              console.log('[BLE] Dispositivo atualizado na lista. Total:', updated.length);
              return updated;
            }
            // Adicionar novo dispositivo (igual ao BluetoothConnectionScreen linha 680-689)
            const newList = [
              ...prev,
              {
                id: device.id,
                name: device.name || 'Equipamento sem nome',
                rssi: device.rssi ?? null,
                type: 'ble' as const,
              },
            ];
            console.log('[BLE] Novo dispositivo adicionado. Total:', newList.length);
            return newList;
          });

          // Atualizar mapa também
          devicesMapRef.current.set(device.id, {
            id: device.id,
            name: device.name || 'Equipamento sem nome',
            rssi: device.rssi ?? null,
            type: 'ble',
          });
        });

        // Log ANTES do try-catch terminar para garantir que startDeviceScan foi chamado
        console.log('[BLE] startDeviceScan chamado, aguardando callbacks...');
        console.log('[BLE] Scan iniciado com sucesso');
        logUserAction('bluetooth_scan_started', {});
      } catch (error: any) {
        console.error('[BLE] ERRO ao iniciar scan:', error);
        const errorMessage = error?.message || 'Erro ao iniciar busca de dispositivos Bluetooth.';
        logUserAction('bluetooth_scan_start_failed', { error: errorMessage });
        
        // Em caso de erro, limpar timeout e parar scan (igual ao BluetoothConnectionScreen linha 694-703)
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        
        try {
          manager.stopDeviceScan();
        } catch { }
        
        if (isMountedRef.current) {
          setIsScanningDevices(false);
          isScanningRef.current = false;
          setBluetoothErrorMessage(errorMessage);
          setBluetoothPopupMode('error');
          setBluetoothPopupVisible(true);
        }
      }
    },
    [
      contextBleManagerAvailable,
      contextBleManager,
      cleanupScan,
      checkBluetoothPermissions,
      openSystemBluetoothSettings,
      logUserAction,
      connectedDevice,
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
      
      // Usar contextBleManager diretamente em vez de bleManagerRef.current
      // pois o ref pode não estar atualizado ainda
      const manager = contextBleManager || bleManagerRef.current;
      console.log('[BLE HomeWip] handleBluetoothPermission - manager disponível:', !!manager, 'contextBleManagerAvailable:', contextBleManagerAvailable);
      
      if (contextBleManagerAvailable && manager) {
        
        // Verificar estado do Bluetooth (igual ao enableBluetooth do BluetoothConnectionScreen)
        try {
          // Registrar listener de estado do Bluetooth (igual ao BluetoothConnectionScreen)
          if (!bluetoothStateSubscriptionRef.current) {
            let subscription: Subscription | null = null;

            try {
              subscription = manager.onStateChange(
                (state: BleState) => {
                  if (!isMountedRef.current) return;
                  
                  console.log('[BLE] Estado do Bluetooth mudou para:', state);
                  logUserAction('bluetooth_state_changed', { state });
                  
                  if (state === 'PoweredOff') {
                    console.log('[BLE] Bluetooth desligado, parando scan...');
                    // Parar scan se o Bluetooth for desligado (igual ao BluetoothConnectionScreen)
                    if (isScanningRef.current) {
                      try {
                        if (bleManagerRef.current) {
                          bleManagerRef.current.stopDeviceScan();
                        }
                      } catch (e) {
                        console.warn('[BLE] Erro ao parar scan:', e);
                      }
                      setIsScanningDevices(false);
                      isScanningRef.current = false;
                      
                      // Limpar timeout
                      if (scanTimeoutRef.current) {
                        clearTimeout(scanTimeoutRef.current);
                        scanTimeoutRef.current = null;
                      }
                    }
                    // Limpar dispositivo conectado quando o Bluetooth é desligado
                    if (isMountedRef.current) {
                      setConnectedDevice(null);
                      setBluetoothErrorMessage(
                        'Bluetooth desligado. Por favor, ligue o Bluetooth e tente novamente.'
                      );
                      setBluetoothPopupMode('error');
                      setBluetoothPopupVisible(true);
                    }
                  }
                },
                true,
              );
              bluetoothStateSubscriptionRef.current = subscription;
              logUserAction('bluetooth_state_listener_registered', { withInitialState: true });
            } catch (error: any) {
              console.warn(
                '[BLE] Erro ao registrar listener com true, tentando com false:',
                error,
              );
              logUserAction('bluetooth_state_listener_error', { error: error?.message });

              try {
                subscription = manager.onStateChange(
                  (state: BleState) => {
                    if (!isMountedRef.current) return;
                    
                    console.log('[BLE] Estado do Bluetooth mudou para:', state);
                    logUserAction('bluetooth_state_changed', { state });
                    
                    if (state === 'PoweredOff') {
                      console.log('[BLE] Bluetooth desligado, parando scan...');
                      // Parar scan se o Bluetooth for desligado (igual ao BluetoothConnectionScreen)
                      if (isScanningRef.current) {
                        try {
                          if (bleManagerRef.current) {
                            bleManagerRef.current.stopDeviceScan();
                          }
                        } catch (e) {
                          console.warn('[BLE] Erro ao parar scan:', e);
                        }
                        setIsScanningDevices(false);
                        isScanningRef.current = false;
                        
                        // Limpar timeout
                        if (scanTimeoutRef.current) {
                          clearTimeout(scanTimeoutRef.current);
                          scanTimeoutRef.current = null;
                        }
                      }
                      // Limpar dispositivo conectado quando o Bluetooth é desligado
                      if (isMountedRef.current) {
                        setConnectedDevice(null); // Usar setConnectedDevice do contexto
                        setBluetoothErrorMessage(
                          'Bluetooth desligado. Por favor, ligue o Bluetooth e tente novamente.'
                        );
                        setBluetoothPopupMode('error');
                        setBluetoothPopupVisible(true);
                      }
                    }
                  },
                  false,
                );
                bluetoothStateSubscriptionRef.current = subscription;
                logUserAction('bluetooth_state_listener_registered', { withInitialState: false });
              } catch (fallbackError: any) {
                console.error(
                  '[BLE] Erro ao registrar listener com false também:',
                  fallbackError,
                );
                logUserAction('bluetooth_state_listener_critical_error', { 
                  error: fallbackError?.message 
                });
              }
            }
          }
          
          // Verificar estado atual do Bluetooth
          const currentState = await manager.state();
          
          if (currentState === 'PoweredOn') {
            // Bluetooth está ligado - apenas mudar para modo 'devices' e mostrar popup
            // O scan será iniciado apenas quando o usuário clicar em 'Atualizar lista'
            logUserAction('bluetooth_already_enabled', { state: currentState });
            setBluetoothPopupMode('devices');
            setBluetoothPopupVisible(true);
            setBluetoothInfoMessage(null);
            setBluetoothErrorMessage(null);
          } else {
            // Bluetooth não está ligado - mostrar erro
            setBluetoothErrorMessage(
              'Bluetooth desligado. Por favor, ligue o Bluetooth e tente novamente.'
            );
            setBluetoothPopupMode('error');
            setBluetoothPopupVisible(true);
          }
        } catch (error: any) {
          logUserAction('bluetooth_state_check_error', { error: error?.message });
          // Em caso de erro, apenas mostrar popup em modo 'devices'
          setBluetoothPopupMode('devices');
          setBluetoothPopupVisible(true);
          setBluetoothInfoMessage(null);
          setBluetoothErrorMessage(null);
        }
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
    contextBleManagerAvailable,
    contextBleManager,
    isRequestingBluetooth,
    startBluetoothScan,
    requestBluetoothPermissions,
    cleanupScan,
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
    contextBleManagerAvailable,
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

  const handleRefreshDeviceList = useCallback(async () => {
    // Seguir exatamente a lógica do botão 'Escanear Dispositivos' do BluetoothConnectionScreen
    if (connectingDeviceId) {
      return;
    }
    
    console.log('[BLE] === Iniciando refresh de dispositivos ===');
    logUserAction('bluetooth_refresh_device_list', {});
    
    // Usar contextBleManager diretamente ou bleManagerRef como fallback
    const manager = contextBleManager || bleManagerRef.current;
    if (!manager) {
      setBluetoothErrorMessage(
        'O módulo de Bluetooth não está disponível neste ambiente.'
      );
      setBluetoothPopupMode('error');
      setBluetoothPopupVisible(true);
      return;
    }
    
    // Verificar estado do Bluetooth (igual ao BluetoothConnectionScreen linha 550-554)
    try {
      const state = await manager.state();
      if (state !== 'PoweredOn') {
        setBluetoothErrorMessage(
          'Bluetooth desligado. Por favor, ligue o Bluetooth e tente novamente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }
    } catch (error: any) {
      console.error('[BLE] Erro ao verificar estado do Bluetooth:', error);
      setBluetoothErrorMessage(
        `Erro ao verificar estado do Bluetooth: ${error?.message || 'Erro desconhecido'}`
      );
      setBluetoothPopupMode('error');
      setBluetoothPopupVisible(true);
      return;
    }
    
    // Se já está escaneando, esse clique serve para PARAR manualmente (igual ao BluetoothConnectionScreen linha 557-573)
    if (isScanningRef.current) {
      try {
        manager.stopDeviceScan();
        setIsScanningDevices(false);
        isScanningRef.current = false;
        console.log('[BLE] Scan parado manualmente pelo usuário.');
        logUserAction('bluetooth_scan_stopped_manually', {});
        
        // Limpar timeout
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        
        setBluetoothInfoMessage(null);
        return;
      } catch (e: any) {
        console.warn(`[BLE] Erro ao parar scan: ${e?.message || String(e)}`);
      }
    }
    
    // Iniciar novo scan (igual ao BluetoothConnectionScreen linha 575-705)
    await startBluetoothScan({ autoOpenSettingsOnPowerOff: false });
  }, [
    connectingDeviceId,
    startBluetoothScan,
    logUserAction,
  ]);

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
      setConnecting(true); // Usar setConnecting do contexto
      setBluetoothInfoMessage('Conectando ao equipamento...');
      setBluetoothErrorMessage(null);
      logUserAction('bluetooth_device_connection_started', {
        deviceId,
        deviceType: device.type,
      });

      try {
        // Conectar via BLE
      const manager = bleManagerRef.current || contextBleManager;
      if (!contextBleManagerAvailable || !manager) {
          throw new Error(
            'O módulo de Bluetooth não está disponível neste ambiente.'
          );
        }

        const bleDevice = await manager.connectToDevice(deviceId, {
          timeout: 10000,
        });
        await bleDevice.discoverAllServicesAndCharacteristics();

        if (!isMountedRef.current) {
          return;
        }

        const deviceName =
          bleDevice.name?.trim() ||
          bleDevice.localName?.trim() ||
          'Equipamento';

        const deviceInfo = { id: bleDevice.id, name: deviceName };
        // Usar setConnectedDevice do contexto para persistir entre navegações
        setConnectedDevice(deviceInfo);
        setBluetoothInfoMessage('Equipamento conectado com sucesso!');
        logUserAction('bluetooth_ble_device_connected', {
          deviceId: bleDevice.id,
          deviceName,
        });

        // Limpar connectingDeviceId após conexão bem-sucedida
        setConnectingDeviceId(null);
        setConnecting(false); // Usar setConnecting do contexto

        // Aguardar 300ms e fechar o popup (mantendo a conexão ativa)
        // IMPORTANTE: Limpar qualquer timeout anterior ANTES de setar connectedDevice
        // para evitar que o useEffect cleanup limpe este timeout
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = null;
        }
        
        console.log('[BLE] Agendando fechamento do popup em 300ms...');
        
        // Agendar o fechamento do popup ANTES de setar connectedDevice
        // para evitar que o useEffect seja executado e limpe o timeout
        const timeoutId = setTimeout(() => {
          console.log('[BLE] Executando timeout de fechamento do popup...');
          if (!isMountedRef.current) {
            console.log('[BLE] Componente não montado, não fechando popup');
            return;
          }
          console.log('[BLE] Fechando popup após conexão bem-sucedida...');
          // Fechar popup após 300ms, mas manter a conexão ativa
          setBluetoothPopupVisible(false);
          setBluetoothPopupMode('devices');
          setBluetoothInfoMessage(null);
          // Manter connectedDevice ativo para uso nas próximas telas
          console.log('[BLE] Popup fechado, conexão mantida ativa');
        }, 300);
        
        // Armazenar o timeout ID no ref
        successTimeoutRef.current = timeoutId;
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
          setConnecting(false); // Usar setConnecting do contexto
        }
      }
    },
    [
      contextBleManagerAvailable,
      contextBleManager,
      cleanupScan,
      connectingDeviceId,
      logUserAction,
      startBluetoothScan,
      setConnectedDevice,
      setConnecting,
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
        connectedDeviceId={connectedDevice?.id || null}
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
