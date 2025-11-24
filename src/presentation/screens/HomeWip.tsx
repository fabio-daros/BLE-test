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
  StatusBar, // Adicionar StatusBar
} from 'react-native';
import type { Permission } from 'react-native';
import { BleManager, BleError } from 'react-native-ble-plx';
import type { State as BleState } from 'react-native-ble-plx';
import { useNavigationLogger } from '@services/logging';
import Logo from '@assets/lampinpuntologo.svg';
import { BottomBar } from '@/ui/BottomBar';
import { HomeHeader } from '../components/HomeHeader';
import { colors } from '@presentation/theme';
import { PopUpRequestBluetooth } from '../components/PopUpRequestBluetooth';
import type { BluetoothDevice } from '@services/bluetooth/types';
import { useBluetooth } from '@/contexts/BluetoothContext';

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

  // ===== CONTEXTO BLUETOOTH =====
  const {
    connectedDevice,
    setConnectedDevice,
    isConnecting,
    setConnecting,
    bleManager: contextBleManager,
    bleManagerAvailable: contextBleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  // boolean derivado – substitui hasConnectedDevice()
  const isDeviceConnected = !!connectedDevice;

  // ===== ESTADOS LOCAIS =====
  const [isBluetoothPopupVisible, setBluetoothPopupVisible] = useState(false);
  const hasInitialPopupShownRef = useRef(false);
  const lastPopupCloseTimeRef = useRef<number>(0); // 👈 Adicionar ref para rastrear quando foi fechado
  const popupCooldownMs = 3000; // 👈 Delay de 3 segundos antes de reabrir
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

  // ===== REFS INTERNAS =====
  const bleManagerRef = useRef<BleManager | null>(contextBleManager || null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devicesMapRef = useRef(new Map<string, BluetoothDevice>());
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isScanningRef = useRef(false);

  const androidVersion =
    Platform.OS === 'android'
      ? typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(Platform.Version as string, 10)
      : null;

  // Atualiza ref quando o manager do contexto mudar
  useEffect(() => {
    if (contextBleManager) {
      bleManagerRef.current = contextBleManager;
    }
  }, [contextBleManager]);

  // ===== POPUP INICIAL + LIMPEZA BÁSICA =====
  useEffect(() => {
    isMountedRef.current = true;

    // Se já tiver dispositivo conectado, não mostrar popup inicial
    if (isDeviceConnected) {
      hasInitialPopupShownRef.current = true;
      return; // 👈 Retornar cedo se já estiver conectado
    }

    const showPopupTimer = setTimeout(async () => {
      if (
        isMountedRef.current &&
        !hasInitialPopupShownRef.current &&
        !isBluetoothPopupVisible &&
        !isDeviceConnected
      ) {
        // 👈 Verificar se passou o cooldown desde o último fechamento
        const timeSinceLastClose = Date.now() - lastPopupCloseTimeRef.current;
        if (timeSinceLastClose < popupCooldownMs) {
          console.log('[BLE] Popup fechado recentemente, aguardando cooldown...');
          return;
        }

        // 👈 Verificar se as permissões já foram concedidas
        const hasPermissions = await checkBluetoothPermissions();
        
        if (hasPermissions) {
          // Se já tem permissões, mostrar popup no modo 'devices' para seleção do dispositivo
          setBluetoothPopupMode('devices');
          hasInitialPopupShownRef.current = true;
          console.log('[BLE] Permissões já concedidas, mostrando popup de seleção de dispositivos');
          setBluetoothErrorMessage(null);
          setBluetoothInfoMessage(null);
          setBluetoothPopupVisible(true);
          
          // 👈 Iniciar scan automaticamente quando abrir o popup em modo 'devices'
          setTimeout(() => {
            startBluetoothScan({ autoOpenSettingsOnPowerOff: false }).catch(error => {
              console.error('[BLE HomeWip] Erro ao iniciar scan automático:', error);
            });
          }, 300);
          return;
        }

        // Se não tem permissões, mostrar popup de solicitação
        setBluetoothPopupMode('request');
        hasInitialPopupShownRef.current = true;
        logUserAction('bluetooth_permission_popup_shown_on_init');
        setBluetoothErrorMessage(null);
        setBluetoothInfoMessage(null);
        setBluetoothPopupVisible(true);
      }
    }, 800);

    return () => {
      clearTimeout(showPopupTimer);

      try {
        const manager = contextBleManager || bleManagerRef.current;
        if (manager && isScanningRef.current) {
          console.log('[BLE] Cleanup do useEffect: parando scan ativo');
          manager.stopDeviceScan();
        }
      } catch {
        // ignora
      }

    };
  }, [isBluetoothPopupVisible, isDeviceConnected]); // checkBluetoothPermissions é um useCallback estável, não precisa estar nas dependências

  //  Adicionar novo useEffect para monitorar quando o popup fecha e reabrir após cooldown
  useEffect(() => {
    // Se o popup foi fechado e não há dispositivo conectado, agendar reabertura
    if (!isBluetoothPopupVisible && !isDeviceConnected) {
      const timeSinceLastClose = Date.now() - lastPopupCloseTimeRef.current;
      const remainingCooldown = Math.max(0, popupCooldownMs - timeSinceLastClose);
      
      // 👈 Só agendar reabertura se o cooldown já passou ou se passou tempo suficiente
      if (remainingCooldown > 0) {
        const reopenTimer = setTimeout(async () => {
          if (
            isMountedRef.current &&
            !isBluetoothPopupVisible &&
            !isDeviceConnected
          ) {
            const hasPermissions = await checkBluetoothPermissions();
            
            if (hasPermissions) {
              setBluetoothPopupMode('devices');
              console.log('[BLE] Reabrindo popup após cooldown (modo devices)');
              setBluetoothErrorMessage(null);
              setBluetoothInfoMessage(null);
              setBluetoothPopupVisible(true);
              
              // 👈 Iniciar scan automaticamente quando reabrir o popup em modo 'devices'
              setTimeout(() => {
                startBluetoothScan({ autoOpenSettingsOnPowerOff: false }).catch(error => {
                  console.error('[BLE HomeWip] Erro ao iniciar scan automático:', error);
                });
              }, 300);
            } else {
              setBluetoothPopupMode('request');
              console.log('[BLE] Reabrindo popup após cooldown (modo request)');
              setBluetoothErrorMessage(null);
              setBluetoothInfoMessage(null);
              setBluetoothPopupVisible(true);
            }
          }
        }, remainingCooldown);

        return () => {
          clearTimeout(reopenTimer);
        };
      } else {
        // 👈 Se o cooldown já passou, reabrir imediatamente
        const reopenImmediately = async () => {
          if (
            isMountedRef.current &&
            !isBluetoothPopupVisible &&
            !isDeviceConnected
          ) {
            const hasPermissions = await checkBluetoothPermissions();
            
            if (hasPermissions) {
              setBluetoothPopupMode('devices');
              console.log('[BLE] Reabrindo popup imediatamente (modo devices)');
              setBluetoothErrorMessage(null);
              setBluetoothInfoMessage(null);
              setBluetoothPopupVisible(true);
              
              // 👈 Iniciar scan automaticamente quando reabrir o popup em modo 'devices'
              setTimeout(() => {
                startBluetoothScan({ autoOpenSettingsOnPowerOff: false }).catch(error => {
                  console.error('[BLE HomeWip] Erro ao iniciar scan automático:', error);
                });
              }, 300);
            } else {
              setBluetoothPopupMode('request');
              console.log('[BLE] Reabrindo popup imediatamente (modo request)');
              setBluetoothErrorMessage(null);
              setBluetoothInfoMessage(null);
              setBluetoothPopupVisible(true);
            }
          }
        };
        
        reopenImmediately();
        return undefined; // 👈 Retornar undefined quando não há cleanup necessário
      }
    }
    return undefined; // 👈 Retornar undefined quando a condição não é satisfeita
  }, [isBluetoothPopupVisible, isDeviceConnected]);

  // Cleanup apenas no unmount real
  useEffect(() => {
    return () => {
      console.log('[BLE] Componente desmontando, limpando tudo...');
      isMountedRef.current = false;
      hasInitialPopupShownRef.current = false;

      if (successTimeoutRef.current) {
        console.log('[BLE] Limpando successTimeoutRef no unmount');
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, []);

  // ===== HANDLERS DE NAVEGAÇÃO =====
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

  // ===== BLE: cleanupScan (ignora BleError "Unknown error occurred") =====
  const cleanupScan = useCallback(
    async () => {
      console.log('[BLE] ===== cleanupScan chamado =====');
      console.log('[BLE] isScanningRef.current:', isScanningRef.current);

      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      const manager = contextBleManager || bleManagerRef.current;

      if (!manager) {
        console.log('[BLE] cleanupScan: manager inexistente');
        if (isMountedRef.current) {
          setIsScanningDevices(false);
          isScanningRef.current = false;
        }
        return;
      }

      try {
        console.log('[BLE] Tentando parar scan em cleanupScan...');
        manager.stopDeviceScan();
        console.log('[BLE] Scan parado via cleanupScan');
      } catch (e: any) {
        const msg = e?.message || String(e);

        if (
          e instanceof BleError &&
          typeof msg === 'string' &&
          msg.includes(
            'Unknown error occurred. This is probably a bug! Check reason property.'
          )
        ) {
          console.log(
            '[BLE] Ignorando BleError "Unknown error occurred" dentro de cleanupScan:',
            msg
          );
          // NÃO relança → não vira unhandled rejection
        } else {
          console.warn('[BLE] Erro ao parar scan em cleanupScan:', e);
        }
      } finally {
        if (isMountedRef.current) {
          setIsScanningDevices(false);
          isScanningRef.current = false;
        }
      }
    },
    [contextBleManager]
  );

  // ===== PERMISSÕES =====
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

  const requestBluetoothPermissions = useCallback(async (): Promise<boolean> => {
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

  // ===== ABRIR CONFIGURAÇÕES DO SISTEMA =====
  const openSystemBluetoothSettings = useCallback(async () => {
    if (hasOpenedBluetoothSettings) {
      return;
    }

    const markAsOpened = () => {
      setHasOpenedBluetoothSettings(true);
    };

    try {
      if (Platform.OS === 'android') {
        try {
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
          console.warn(
            'Intent launcher não disponível, usando Linking:',
            intentError
          );
        }

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

  // ===== SCAN BLUETOOTH =====
  const startBluetoothScan = useCallback(
    async (options?: { autoOpenSettingsOnPowerOff?: boolean }) => {
      const hasPermissions = await checkBluetoothPermissions();
      if (!hasPermissions) {
        setBluetoothErrorMessage(
          'Permissões Bluetooth não concedidas. Por favor, conceda as permissões necessárias.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      const managerReady = await ensureBleManagerReady();
      if (!managerReady) {
        setBluetoothErrorMessage(
          'Não foi possível inicializar o módulo de Bluetooth. Tente fechar e abrir o app novamente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      const manager = contextBleManager || bleManagerRef.current;
      if (!manager) {
        setBluetoothErrorMessage(
          'O módulo de Bluetooth não está disponível neste ambiente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      // Verificar estado do Bluetooth
      try {
        let state: BleState;
        try {
          state = await manager.state();
        } catch (stateError: any) {
          console.warn(
            '[BLE] Erro ao verificar estado do Bluetooth:',
            stateError
          );
          setBluetoothErrorMessage(
            'Erro ao verificar estado do Bluetooth. Por favor, verifique se o Bluetooth está ligado e tente novamente.'
          );
          setBluetoothPopupMode('error');
          setBluetoothPopupVisible(true);
          return;
        }

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
          `Erro ao verificar estado do Bluetooth: ${
            error?.message || 'Erro desconhecido'
          }`
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      // Preparar lista de dispositivos
      const currentlyConnected = connectedDevice;
      if (!currentlyConnected) {
        devicesMapRef.current.clear();
        setBluetoothDevices([]);
      } else {
        setBluetoothDevices(prev => {
          const exists = prev.find(d => d.id === currentlyConnected.id);
          if (exists) {
            return prev.map(d =>
              d.id === currentlyConnected.id ? { ...d } : d
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

      // Marcar estado de scanning
      setIsScanningDevices(true);
      isScanningRef.current = true;
      setBluetoothInfoMessage('Buscando dispositivos...');
      setBluetoothErrorMessage(null);
      setBluetoothPopupMode('devices');
      setBluetoothPopupVisible(true);

      // Limpar qualquer timeout anterior ANTES de criar o novo
      if (scanTimeoutRef.current) {
        console.log('[BLE] Limpando timeout anterior antes de iniciar novo scan');
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }

      // Timeout de 10s - CRIAR APÓS o scan iniciar com sucesso
      // Este timeout será criado DENTRO do bloco try onde o scan inicia
      // para garantir que não seja cancelado indevidamente

      // Iniciar scan
      try {
        console.log('[BLE] Iniciando scan de dispositivos...');
        console.log('[BLE] Manager:', manager ? 'OK' : 'NULL');
        logUserAction('bluetooth_scan_starting', {});

        try {
          manager.stopDeviceScan();
          console.log(
            '[BLE] Parando qualquer scan anterior antes de iniciar novo'
          );
          await new Promise<void>(resolve => setTimeout(resolve, 100));
        } catch {
          // ignora
        }

        manager.startDeviceScan(null, null, (error, device) => {
          console.log(
            '[BLE] === CALLBACK CHAMADO ===',
            'error:',
            error ? 'SIM' : 'NÃO',
            'device:',
            device ? 'SIM' : 'NÃO'
          );

          if (error) {
            const msg = (error as any)?.message || 'Erro desconhecido';
            const code = (error as any)?.errorCode || 'N/A';
            const reason = (error as any)?.reason || 'N/A';

            console.error('[BLE] ERRO no scan:', msg);
            console.error('[BLE] Código:', code, 'Razão:', reason);
            logUserAction('bluetooth_scan_error', {
              message: msg,
              code: String(code),
              reason: String(reason),
            });

            if (isMountedRef.current) {
              setIsScanningDevices(false);
              setBluetoothErrorMessage(
                `Erro ao buscar dispositivos: ${msg}`
              );
              setBluetoothPopupMode('error');
            }

            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current);
              scanTimeoutRef.current = null;
            }
            try {
              manager.stopDeviceScan();
            } catch {}

            isScanningRef.current = false;
            return;
          }

          if (!device || !isMountedRef.current) {
            if (!device) {
              console.log('[BLE] Device é null, retornando');
            }
            if (!isMountedRef.current) {
              console.log('[BLE] Componente não está montado, retornando');
            }
            return;
          }

          const name = (device.name || '').trim();
          console.log(
            '[BLE] Dispositivo encontrado no scan:',
            name || '(sem nome)',
            'ID:',
            device.id,
            'RSSI:',
            device.rssi
          );

          if (!name.includes('InPunto')) {
            console.log(
              '[BLE] Dispositivo não contém "InPunto" no nome, ignorando:',
              name
            );
            return;
          }

          console.log(
            '[BLE] Dispositivo InPunto encontrado:',
            name,
            'ID:',
            device.id,
            'RSSI:',
            device.rssi
          );
          logUserAction('bluetooth_device_found', {
            deviceId: device.id,
            deviceName: name,
            rssi: device.rssi,
          });

          setBluetoothDevices(prev => {
            const idx = prev.findIndex(d => d.id === device.id);
            if (idx >= 0) {
              const updated = [...prev];
              const existing = updated[idx];
              updated[idx] = {
                id: device.id,
                name: device.name || 'Equipamento sem nome',
                rssi: device.rssi ?? null,
                type: 'ble' as const,
                ...(existing?.address && { address: existing.address }),
              };
              console.log(
                '[BLE] Dispositivo atualizado na lista. Total:',
                updated.length
              );
              return updated;
            }
            const newList = [
              ...prev,
              {
                id: device.id,
                name: device.name || 'Equipamento sem nome',
                rssi: device.rssi ?? null,
                type: 'ble' as const,
              },
            ];
            console.log(
              '[BLE] Novo dispositivo adicionado. Total:',
              newList.length
            );
            return newList;
          });

          devicesMapRef.current.set(device.id, {
            id: device.id,
            name: device.name || 'Equipamento sem nome',
            rssi: device.rssi ?? null,
            type: 'ble',
          });
        });

        console.log('[BLE] startDeviceScan chamado, aguardando callbacks...');
        console.log('[BLE] Scan iniciado com sucesso');
        logUserAction('bluetooth_scan_started', {});

        // CRIAÇÃO DO TIMEOUT DENTRO DO TRY, APÓS O SCAN INICIAR
        // Isso garante que o timeout só seja criado se o scan iniciar com sucesso
        // e não será cancelado pelo cleanup do useEffect do popup
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }

        scanTimeoutRef.current = setTimeout(() => {
          console.log('[BLE] === TIMEOUT DE 10s EXECUTADO ===');
          console.log('[BLE] Tentando parar scan após 10 segundos...');
          
          try {
            if (manager && isScanningRef.current) {
              manager.stopDeviceScan();
              console.log('[BLE] Scan parado automaticamente por timeout (10s).');
            }
          } catch (e: any) {
            console.warn(
              `[BLE] Erro ao parar scan no timeout: ${e?.message || String(e)}`
            );
          }

          if (isMountedRef.current) {
            console.log('[BLE] Atualizando estados após timeout...');
            setIsScanningDevices(false);
            isScanningRef.current = false;
            setBluetoothInfoMessage(null); // Limpar mensagem para disponibilizar botão
            console.log('[BLE] Estados atualizados. Botão "Atualizar lista" disponível.');
          }

          scanTimeoutRef.current = null;
        }, 10000); // 10 segundos
        
        console.log(`[BLE] Timeout de 10s criado. ID: ${scanTimeoutRef.current}`);
      } catch (error: any) {
        console.error('[BLE] ERRO ao iniciar scan:', error);
        const errorMessage =
          error?.message || 'Erro ao iniciar busca de dispositivos Bluetooth.';
        logUserAction('bluetooth_scan_start_failed', { error: errorMessage });

        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }

        try {
          manager.stopDeviceScan();
        } catch {}

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
      checkBluetoothPermissions,
      ensureBleManagerReady,
      contextBleManager,
      connectedDevice,
      logUserAction,
      openSystemBluetoothSettings,
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

  const handleBluetoothPermission = useCallback(
    async () => {
      if (isRequestingBluetooth) {
        console.log(
          '[BLE HomeWip] handleBluetoothPermission já está sendo executado, ignorando chamada duplicada'
        );
        return;
      }

      hasInitialPopupShownRef.current = true;
      setIsRequestingBluetooth(true);

      try {
        const granted = await requestBluetoothPermissions();

        if (granted) {
          logUserAction('bluetooth_permission_granted');

          const managerReady = await ensureBleManagerReady();
          if (!managerReady) {
            setBluetoothErrorMessage(
              'Não foi possível inicializar o módulo de Bluetooth. Tente fechar e abrir o app novamente.'
            );
            setBluetoothPopupMode('error');
            setBluetoothPopupVisible(true);
            return;
          }

          console.log(
            '[BLE HomeWip] Permissão concedida, mostrando popup de dispositivos'
          );
          logUserAction('bluetooth_permission_granted_showing_devices');

          setBluetoothPopupMode('devices');
          setBluetoothPopupVisible(true);
          setBluetoothInfoMessage(null);
          setBluetoothErrorMessage(null);
          
          // Iniciar scan automaticamente quando abrir o popup em modo 'devices'
          // Aguardar um pequeno delay para garantir que o popup está visível
          setTimeout(() => {
            startBluetoothScan({ autoOpenSettingsOnPowerOff: false }).catch(error => {
              console.error('[BLE HomeWip] Erro ao iniciar scan automático:', error);
            });
          }, 300);
        } else {
          logUserAction('bluetooth_permission_not_granted');
          setBluetoothPopupMode('error');
          setBluetoothErrorMessage(
            'Permissões Bluetooth não concedidas. Por favor, conceda as permissões necessárias.'
          );
          setBluetoothPopupVisible(true);
        }
      } catch (error: any) {
        console.error(
          '[BLE HomeWip] Erro ao processar permissão Bluetooth:',
          error
        );
        logUserAction('bluetooth_permission_request_error', {
          error: error?.message || 'Erro desconhecido',
        });
        setBluetoothPopupMode('error');
        setBluetoothErrorMessage(
          'Erro ao processar solicitação de permissão Bluetooth. Por favor, tente novamente.'
        );
        setBluetoothPopupVisible(true);
      } finally {
        setIsRequestingBluetooth(false);
      }
    },
    [
      isRequestingBluetooth,
      requestBluetoothPermissions,
      ensureBleManagerReady,
      logUserAction,
      startBluetoothScan, // Adicionar startBluetoothScan nas dependências
    ]
  );

  const handleRetryBluetoothPermission = useCallback(async () => {
    setBluetoothErrorMessage(null);
    if (isRequestingBluetooth) {
      return;
    }
    
    // 👈 Se estiver em modo 'error' e houver dispositivos disponíveis, tentar reconectar
    if (bluetoothPopupMode === 'error' && bluetoothDevices.length > 0) {
      // Voltar para modo 'devices' e reiniciar o scan
      setBluetoothPopupMode('devices');
      await startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
      return;
    }
    
    const granted = await checkBluetoothPermissions();
    if (granted) {
      await startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
    } else {
      setBluetoothPopupMode('request');
    }
  }, [checkBluetoothPermissions, isRequestingBluetooth, startBluetoothScan, bluetoothPopupMode, bluetoothDevices.length]);

  const handleCloseBluetoothPopup = useCallback(() => {
    if (isRequestingBluetooth || connectingDeviceId) {
      return;
    }
    cleanupScan().catch(e =>
      console.log(
        '[BLE] cleanupScan rejeitou em handleCloseBluetoothPopup (ignorado):',
        e
      )
    );
    lastPopupCloseTimeRef.current = Date.now(); // 👈 Registrar tempo do fechamento
    setBluetoothPopupVisible(false);
    setBluetoothPopupMode('request');
    setBluetoothInfoMessage(null);
    setBluetoothErrorMessage(null);
    
    // 👈 Se não há dispositivo conectado, resetar para permitir reabertura do popup
    if (!isDeviceConnected) {
      hasInitialPopupShownRef.current = false;
    }
  }, [cleanupScan, connectingDeviceId, isRequestingBluetooth, isDeviceConnected]);

  const handleRefreshDeviceList = useCallback(
    async () => {
      if (connectingDeviceId) {
        return;
      }

      console.log('[BLE] === Iniciando refresh de dispositivos ===');
      logUserAction('bluetooth_refresh_device_list', {});

      const managerReady = await ensureBleManagerReady();
      if (!managerReady) {
        setBluetoothErrorMessage(
          'Não foi possível inicializar o módulo de Bluetooth. Tente fechar e abrir o app novamente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      const manager = contextBleManager || bleManagerRef.current;
      if (!manager) {
        setBluetoothErrorMessage(
          'O módulo de Bluetooth não está disponível neste ambiente.'
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      try {
        let state: BleState;
        try {
          state = await manager.state();
        } catch (stateError: any) {
          console.warn(
            '[BLE] Erro ao verificar estado do Bluetooth:',
            stateError
          );
          setBluetoothErrorMessage(
            'Erro ao verificar estado do Bluetooth. Por favor, verifique se o Bluetooth está ligado e tente novamente.'
          );
          setBluetoothPopupMode('error');
          setBluetoothPopupVisible(true);
          return;
        }
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
          `Erro ao verificar estado do Bluetooth: ${
            error?.message || 'Erro desconhecido'
          }`
        );
        setBluetoothPopupMode('error');
        setBluetoothPopupVisible(true);
        return;
      }

      if (isScanningRef.current) {
        try {
          manager.stopDeviceScan();
          setIsScanningDevices(false);
          isScanningRef.current = false;
          console.log('[BLE] Scan parado manualmente pelo usuário.');
          logUserAction('bluetooth_scan_stopped_manually', {});

          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
          }

          setBluetoothInfoMessage(null);
          return;
        } catch (e: any) {
          console.warn(
            `[BLE] Erro ao parar scan: ${e?.message || String(e)}`
          );
        }
      }

      await startBluetoothScan({ autoOpenSettingsOnPowerOff: false });
    },
    [
      connectingDeviceId,
      startBluetoothScan,
      logUserAction,
      ensureBleManagerReady,
      contextBleManager,
    ]
  );

  const handleSelectBluetoothDevice = useCallback(
    async (deviceId: string) => {
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

      try {
        await cleanupScan();
      } catch (e) {
        console.log(
          '[BLE] cleanupScan rejeitou (ignorado em handleSelectBluetoothDevice):',
          e
        );
      }

      setConnectingDeviceId(deviceId);
      setConnecting(true);
      setBluetoothInfoMessage('Conectando ao equipamento...');
      setBluetoothErrorMessage(null);
      logUserAction('bluetooth_device_connection_started', {
        deviceId,
        deviceType: device.type,
      });

      try {
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
        setConnectedDevice(deviceInfo);
        setBluetoothInfoMessage('Equipamento conectado com sucesso!');
        logUserAction('bluetooth_ble_device_connected', {
          deviceId: bleDevice.id,
          deviceName,
        });

        setConnectingDeviceId(null);
        setConnecting(false);

        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = null;
        }

        console.log('[BLE] Agendando fechamento do popup em 300ms...');

        const timeoutId = setTimeout(() => {
          console.log('[BLE] Executando timeout de fechamento do popup...');
          if (!isMountedRef.current) {
            console.log(
              '[BLE] Componente não montado, não fechando popup'
            );
            return;
          }
          console.log(
            '[BLE] Fechando popup após conexão bem-sucedida...'
          );
          setBluetoothPopupVisible(false);
          setBluetoothPopupMode('devices');
          setBluetoothInfoMessage(null);
          console.log('[BLE] Popup fechado, conexão mantida ativa');
        }, 300);

        successTimeoutRef.current = timeoutId;
      } catch (error: any) {
        if (!isMountedRef.current) {
          return;
        }

        logUserAction('bluetooth_device_connection_failed', {
          deviceId,
          deviceType: device.type,
          message: error?.message || 'Erro desconhecido',
        });
        setBluetoothErrorMessage(
          'Não foi possível conectar ao equipamento. Verifique se ele está ligado e tente novamente.'
        );
        setBluetoothPopupMode('error'); // 👈 Mudar de 'devices' para 'error'
        setBluetoothPopupVisible(true);
        // 👈 Remover o startBluetoothScan automático, deixar o usuário clicar em "Tentar Novamente"
        // await startBluetoothScan({ autoOpenSettingsOnPowerOff: true });
      } finally {
        if (isMountedRef.current) {
          setConnectingDeviceId(null);
          setConnecting(false);
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

  // ===== RENDER =====
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundGrayAlt2} />
      <View style={styles.container}>
        {/* HEADER */}
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

        {/* LOGO */}
        <View style={styles.logoWrap}>
          <Logo width={160} height={160} />
        </View>

        {/* TEXTO CENTRAL */}
        <View style={styles.centerText}>
          <Text style={styles.welcome}>
            Bem-vindo(a), <Text style={styles.welcomeBold}>{userName}!</Text>
          </Text>

          <View style={styles.divider} />

          <Text style={styles.question}>Vamos começar?</Text>
          <Text style={styles.helper}>
            Toque no botão{'\n'}abaixo para iniciar.
          </Text>
        </View>

        {/* BOTÕES */}
        <View style={styles.buttonsContainer}>
          {/* BOTÃO PRINCIPAL */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleStartTest}>
            <Text style={styles.primaryBtnText}>Iniciar</Text>
          </TouchableOpacity>

          {/* BOTÃO TUTORIAL */}
          {onTutorial && (
            <TouchableOpacity style={styles.tutorialBtn} onPress={onTutorial}>
              <Text style={styles.tutorialBtnText}>Tutorial</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* BARRA INFERIOR */}
        <BottomBar fixed={true} />
      </View>

      <PopUpRequestBluetooth
        visible={isBluetoothPopupVisible}
        mode={bluetoothPopupMode}
        loading={isRequestingBluetooth || !!connectingDeviceId || isConnecting}
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
  safe: { 
    flex: 1, 
    backgroundColor: colors.backgroundGrayAlt2,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0, // Garantir que não há paddingTop
    justifyContent: 'space-between',
  },

  /* LOGO */
  logoWrap: {
    alignItems: 'center',
    marginTop: 32,
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

  /* BOTÕES */
  buttonsContainer: {
    marginTop: 24,
    marginBottom: 70,
    marginHorizontal: 32,
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8, // 👈 Reduzir de 28 para 8 (mais quadrado)
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12, // 👈 Espaçamento entre os botões
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  tutorialBtn: {
    backgroundColor: colors.backgroundGrayAlt2, // 👈 Cor de fundo off-white
    borderRadius: 8, // 👈 Reduzir de 28 para 8 (mais quadrado)
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold, // 👈 Borda dourada
  },
  tutorialBtnText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 16,
  },
});
