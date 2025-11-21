// src/contexts/BluetoothContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { BleManager } from 'react-native-ble-plx';
import type { Device, State as BleState, Subscription } from 'react-native-ble-plx';
import { useNavigationLogger } from '@services/logging';

export interface ConnectedDevice {
  id: string;
  name: string;
}

interface BluetoothContextValue {
  // Estado
  connectedDevice: ConnectedDevice | null;
  isConnecting: boolean;
  bleManager: BleManager | null;
  bleManagerAvailable: boolean;
  
  // Métodos
  setConnectedDevice: (device: ConnectedDevice | null) => void;
  setConnecting: (connecting: boolean) => void;
  disconnect: () => Promise<void>;
  
  // Verificar se há dispositivo conectado
  hasConnectedDevice: () => boolean;
}

const BluetoothContext = createContext<BluetoothContextValue | null>(null);

interface BluetoothProviderProps {
  children: ReactNode;
}

export const BluetoothProvider: React.FC<BluetoothProviderProps> = ({
  children,
}) => {
  const { logUserAction } = useNavigationLogger({
    screenName: 'BluetoothContext',
    additionalContext: {},
  });

  const [connectedDevice, setConnectedDeviceState] = useState<ConnectedDevice | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bleManagerAvailable, setBleManagerAvailable] = useState(true);
  
  const bleManagerRef = useRef<BleManager | null>(null);
  const bluetoothStateSubscriptionRef = useRef<Subscription | null>(null);
  const isMountedRef = useRef(true);

  // Inicializar BleManager (lazy initialization - só quando necessário)
  useEffect(() => {
    isMountedRef.current = true;

    try {
      // Inicializar BleManager de forma segura
      const manager = new BleManager();
      bleManagerRef.current = manager;
      setBleManagerAvailable(true);
      logUserAction('bluetooth_manager_initialized', { context: 'BluetoothProvider' });

      // Registrar listener de estado do Bluetooth
      if (!bluetoothStateSubscriptionRef.current) {
        try {
          // Tentar registrar listener sem emitir estado inicial primeiro (mais seguro)
          const subscription = manager.onStateChange(
            (state: BleState) => {
              if (!isMountedRef.current) return;

              console.log('[BLE Context] Estado do Bluetooth mudou para:', state);
              logUserAction('bluetooth_state_changed', { state, context: 'BluetoothProvider' });

              if (state === 'PoweredOff') {
                console.log('[BLE Context] Bluetooth desligado, limpando dispositivo conectado');
                // Limpar dispositivo conectado quando o Bluetooth é desligado
                setConnectedDeviceState(null);
              }
            },
            false, // Começar com false para evitar erro na inicialização
          );
          bluetoothStateSubscriptionRef.current = subscription;
          logUserAction('bluetooth_state_listener_registered', {
            withInitialState: false,
            context: 'BluetoothProvider',
          });
        } catch (error: any) {
          console.error(
            '[BLE Context] Erro ao registrar listener de estado do Bluetooth:',
            error,
          );
          logUserAction('bluetooth_state_listener_critical_error', {
            error: error?.message || 'Erro desconhecido',
            context: 'BluetoothProvider',
          });
        }
      }

      // Verificar se há dispositivos conectados quando o contexto é inicializado
      const checkConnectedDevices = async () => {
        try {
          // Tentar verificar se há dispositivos conectados
          // Nota: Isso pode não funcionar sem SERVICE_UUID, mas tentamos de qualquer forma
          if (connectedDevice) {
            try {
              // Tentar obter o dispositivo pelo ID para verificar se ainda está conectado
              const devices = await (manager as any).devices([connectedDevice.id]);
              if (devices && devices.length > 0) {
                const device = devices[0];
                const isConnected = await device.isConnected();
                if (!isConnected) {
                  console.log('[BLE Context] Dispositivo não está mais conectado, limpando');
                  setConnectedDeviceState(null);
                } else {
                  console.log('[BLE Context] Dispositivo ainda está conectado:', connectedDevice.name);
                }
              } else {
                console.log('[BLE Context] Dispositivo não encontrado, limpando');
                setConnectedDeviceState(null);
              }
            } catch (checkError) {
              console.warn('[BLE Context] Erro ao verificar conexão do dispositivo:', checkError);
              // Se houver erro, manter o estado (pode ser que o método não exista)
            }
          }
        } catch (error) {
          console.warn('[BLE Context] Erro ao verificar dispositivos conectados:', error);
        }
      };

      // Verificar dispositivos conectados após um pequeno delay
      setTimeout(() => {
        if (isMountedRef.current) {
          checkConnectedDevices();
        }
      }, 100);
    } catch (error) {
      console.error('[BLE Context] Erro ao inicializar BleManager:', error);
      bleManagerRef.current = null;
      setBleManagerAvailable(false);
      // Não logar erro se for um erro conhecido (ex: permissões não concedidas ainda)
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        // Só logar se não for um erro esperado
        if (!errorMessage.includes('permission') && !errorMessage.includes('Permission')) {
          logUserAction('bluetooth_manager_init_failed', {
            message: errorMessage,
            context: 'BluetoothProvider',
          });
        }
      }
    }

    return () => {
      isMountedRef.current = false;

      // Remover listener de estado do Bluetooth
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
        }
      } catch (e: any) {
        console.warn('[BLE Context] Erro ao destruir BleManager:', e);
      }
    };
  }, [logUserAction]);

  // Função para definir dispositivo conectado
  const setConnectedDevice = useCallback((device: ConnectedDevice | null) => {
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

  // Função para desconectar
  const disconnect = useCallback(async () => {
    if (!connectedDevice || !bleManagerRef.current) {
      return;
    }

    try {
      console.log('[BLE Context] Desconectando dispositivo:', connectedDevice.name);
      await bleManagerRef.current.cancelDeviceConnection(connectedDevice.id);
      setConnectedDeviceState(null);
      logUserAction('bluetooth_device_disconnected', {
        deviceId: connectedDevice.id,
        deviceName: connectedDevice.name,
        context: 'BluetoothProvider',
      });
    } catch (error) {
      console.error('[BLE Context] Erro ao desconectar dispositivo:', error);
      logUserAction('bluetooth_device_disconnect_failed', {
        deviceId: connectedDevice.id,
        error: (error as Error).message,
        context: 'BluetoothProvider',
      });
    }
  }, [connectedDevice, logUserAction]);

  // Função para verificar se há dispositivo conectado
  const hasConnectedDevice = useCallback(() => {
    return connectedDevice !== null;
  }, [connectedDevice]);

  const value: BluetoothContextValue = {
    connectedDevice,
    isConnecting,
    bleManager: bleManagerRef.current,
    bleManagerAvailable,
    setConnectedDevice,
    setConnecting,
    disconnect,
    hasConnectedDevice,
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = (): BluetoothContextValue => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetooth deve ser usado dentro de BluetoothProvider');
  }
  return context;
};

