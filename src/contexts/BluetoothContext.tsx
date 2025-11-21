import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { BleManager } from 'react-native-ble-plx';
import type { BleManager as BleManagerType, State as BleState, Subscription } from 'react-native-ble-plx';
import { useNavigationLogger } from '@services/logging';
import { Platform } from 'react-native';

// Tipo mínimo que o HomeWip usa para o dispositivo conectado
export type ConnectedDevice = {
  id: string;
  name: string;
} | null;

type BluetoothContextValue = {
  bleManager: BleManagerType | null;
  bleManagerAvailable: boolean;
  ensureBleManagerReady: () => Promise<boolean>;
  isConnecting: boolean;
  setConnecting: (value: boolean) => void;
  connectedDevice: ConnectedDevice;
  setConnectedDevice: (device: ConnectedDevice) => void;
};

const defaultValue: BluetoothContextValue = {
  bleManager: null,
  bleManagerAvailable: false,
  ensureBleManagerReady: async () => false,
  isConnecting: false,
  setConnecting: () => {},
  connectedDevice: null,
  setConnectedDevice: () => {},
};

const BluetoothContext = createContext<BluetoothContextValue>(defaultValue);

export const BluetoothProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { logUserAction } = useNavigationLogger({
    screenName: 'BluetoothContext',
    additionalContext: {},
  });

  const [connectedDevice, setConnectedDeviceState] = useState<ConnectedDevice>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bleManager, setBleManager] = useState<BleManagerType | null>(null);
  const [bleManagerAvailable, setBleManagerAvailable] = useState(false);

  const bleManagerRef = useRef<BleManagerType | null>(null);
  const bluetoothStateSubscriptionRef = useRef<Subscription | null>(null);
  const isMountedRef = useRef(true);
  const initializationRef = useRef(false);
  const initializationPromiseRef = useRef<Promise<boolean> | null>(null);

  // Função para garantir que o BleManager está pronto
  const ensureBleManagerReady = useCallback(async (): Promise<boolean> => {
    // Se já está inicializado e disponível, retornar true
    if (initializationRef.current && bleManagerRef.current && bleManagerAvailable) {
      console.log('[BLE Context] Manager já está pronto');
      return true;
    }

    // Se já está inicializando, aguardar a promessa existente
    if (initializationPromiseRef.current) {
      console.log('[BLE Context] Aguardando inicialização em andamento...');
      return initializationPromiseRef.current;
    }

    // Iniciar nova inicialização
    console.log('[BLE Context] Iniciando inicialização do BleManager...');
    
    const initPromise = (async (): Promise<boolean> => {
      try {
        // Se já foi inicializado mas algo deu errado, tentar novamente
        if (initializationRef.current && !bleManagerRef.current) {
          initializationRef.current = false;
        }

        if (initializationRef.current) {
          return true;
        }

        // Criar novo BleManager
        const manager = new BleManager();
        bleManagerRef.current = manager;
        setBleManager(manager);
        setBleManagerAvailable(true);
        initializationRef.current = true;

        console.log('[BLE Context] BleManager criado com sucesso');
        logUserAction('bluetooth_manager_initialized', { context: 'BluetoothProvider' });

        // Aguardar um pouco antes de registrar o listener
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

        // Registrar listener de estado apenas se ainda estiver montado
        if (!isMountedRef.current || !manager) {
          console.warn('[BLE Context] Componente desmontado antes de registrar listener');
          return true; // Manager foi criado, mesmo sem listener
        }

        // Remover listener anterior se existir
        if (bluetoothStateSubscriptionRef.current) {
          try {
            bluetoothStateSubscriptionRef.current.remove();
          } catch (e) {
            console.warn('[BLE Context] Erro ao remover subscription anterior:', e);
          }
          bluetoothStateSubscriptionRef.current = null;
        }

        // Registrar listener SEM emitir estado inicial (false) para evitar erro
        try {
          const subscription = manager.onStateChange(
            (state: BleState) => {
              if (!isMountedRef.current) return;

              console.log('[BLE Context] Estado do Bluetooth mudou para:', state);
              logUserAction('bluetooth_state_changed', {
                state,
                context: 'BluetoothContext',
              });

              // Limpar dispositivo conectado quando o Bluetooth é desligado
              if (state === 'PoweredOff') {
                console.log('[BLE Context] Bluetooth desligado, limpando dispositivo conectado');
                setConnectedDeviceState(null);
              }
            },
            false, // SEMPRE false para evitar erro "Unknown error occurred"
          );
          bluetoothStateSubscriptionRef.current = subscription;
          logUserAction('bluetooth_state_listener_registered', {
            withInitialState: false,
            context: 'BluetoothProvider',
          });
          console.log('[BLE Context] Listener de estado registrado com sucesso');
        } catch (error: any) {
          console.error(
            '[BLE Context] Erro ao registrar listener de estado:',
            error
          );
          // Não logar se for o erro conhecido "Unknown error occurred"
          if (!error?.message?.includes('Unknown error occurred')) {
            logUserAction('bluetooth_state_listener_critical_error', {
              error: error?.message || 'Erro desconhecido',
              context: 'BluetoothProvider',
            });
          }
          // Ainda retorna true porque o manager foi criado com sucesso
        }

        return true;
      } catch (error) {
        console.error('[BLE Context] Erro ao inicializar BleManager:', error);
        initializationRef.current = false;
        bleManagerRef.current = null;
        setBleManager(null);
        setBleManagerAvailable(false);

        // Não logar se for o erro conhecido "Unknown error occurred"
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as Error).message;
          if (
            !errorMessage.includes('Unknown error occurred') &&
            !errorMessage.includes('permission') &&
            !errorMessage.includes('Permission')
          ) {
            logUserAction('bluetooth_manager_init_failed', {
              message: errorMessage,
              context: 'BluetoothProvider',
            });
          }
        }
        return false;
      }
    })();

    // Armazenar a promessa para evitar múltiplas inicializações simultâneas
    initializationPromiseRef.current = initPromise;

    try {
      const result = await initPromise;
      return result;
    } finally {
      // Limpar a promessa após completar
      initializationPromiseRef.current = null;
    }
  }, [logUserAction, bleManagerAvailable]);

  // Inicializar automaticamente quando o componente montar
  useEffect(() => {
    isMountedRef.current = true;

    // Tentar inicializar automaticamente apenas uma vez
    if (!initializationRef.current && Platform.OS === 'android') {
      // Não inicializar imediatamente - deixar que ensureBleManagerReady seja chamado quando necessário
      // Isso evita erros de permissão na inicialização
      console.log('[BLE Context] Provider montado, aguardando chamada de ensureBleManagerReady');
    }

    return () => {
      console.log('[BLE Context] Cleanup - desmontando provider');
      isMountedRef.current = false;

      // Remover listener
      try {
        if (bluetoothStateSubscriptionRef.current) {
          bluetoothStateSubscriptionRef.current.remove();
          bluetoothStateSubscriptionRef.current = null;
        }
      } catch (e: any) {
        console.warn('[BLE Context] Erro ao remover subscription:', e);
      }

      // Destruir BleManager
      try {
        if (bleManagerRef.current) {
          bleManagerRef.current.destroy();
          bleManagerRef.current = null;
          setBleManager(null);
        }
      } catch (e: any) {
        console.warn('[BLE Context] Erro ao destruir BleManager:', e);
      }

      initializationRef.current = false;
      setBleManagerAvailable(false);
      initializationPromiseRef.current = null;
    };
  }, []);

  // Função para definir dispositivo conectado
  const setConnectedDevice = useCallback((device: ConnectedDevice) => {
    console.log('[BLE Context] Definindo dispositivo conectado:', device);
    setConnectedDeviceState(device);
    if (device) {
      logUserAction('bluetooth_device_set_in_context', {
        deviceId: device.id,
        deviceName: device.name,
        context: 'BluetoothProvider',
      });
    } else {
      logUserAction('bluetooth_device_cleared_in_context', {
        context: 'BluetoothProvider',
      });
    }
  }, [logUserAction]);

  // Função para definir estado de conexão
  const setConnecting = useCallback((connecting: boolean) => {
    setIsConnecting(connecting);
  }, []);

  const value: BluetoothContextValue = {
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
    isConnecting,
    setConnecting,
    connectedDevice,
    setConnectedDevice,
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => useContext(BluetoothContext);
