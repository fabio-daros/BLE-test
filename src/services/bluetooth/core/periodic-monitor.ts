import type { Device } from 'react-native-ble-plx';
import { checkConnection, readCharacteristic, type ReadCharacteristicOptions } from './ble-communication';
import { isGattConnectionError } from './utils';

/**
 * Utilitário para monitoramento periódico de características BLE
 */

export interface PeriodicMonitorOptions {
  device: Device;
  readOptions: ReadCharacteristicOptions;
  onUpdate?: (value: string | null) => void;
  intervalMs?: number;
  onMessage?: (msg: string) => void;
}

/**
 * Cria um monitoramento periódico de uma característica
 * Retorna uma função para parar o monitoramento
 */
export async function createPeriodicMonitor(
  options: PeriodicMonitorOptions,
): Promise<() => void> {
  const {
    device,
    readOptions,
    onUpdate,
    intervalMs = 5000,
    onMessage,
  } = options;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isMonitoring = true;
  let disconnectSubscription: any = null;

  const stopMonitoring = () => {
    if (!isMonitoring) return;
    isMonitoring = false;
    
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    if (disconnectSubscription) {
      try {
        disconnectSubscription.remove();
      } catch (e) {
        // Ignora erros ao remover subscription
      }
      disconnectSubscription = null;
    }
  };

  try {
    // Monitoramento periódico iniciado silenciosamente

    // Listener de desconexão para parar imediatamente
    disconnectSubscription = device.onDisconnected(() => {
      if (onMessage) {
        onMessage('⚠️ Dispositivo desconectado, parando monitoramento');
      }
      stopMonitoring();
    });

    // Função para ler o valor
    const readValue = async () => {
      if (!isMonitoring) return;

      try {
        // Verifica conexão antes de ler
        const isConnected = await checkConnection(device, onMessage);
        if (!isConnected) {
          if (onMessage) {
            onMessage('⚠️ Dispositivo desconectado, parando monitoramento');
          }
          stopMonitoring();
          return;
        }

        const value = await readCharacteristic(device, readOptions);
        if (onUpdate && value !== null) {
          onUpdate(value);
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error) || '';

        if (isGattConnectionError(error)) {
          if (onMessage) {
            onMessage('⚠️ Erro de conexão detectado, parando monitoramento');
          }
          stopMonitoring();
        } else {
          if (onMessage) {
            onMessage(`⚠️ Erro ao ler valor: ${errorMsg}`);
          }
        }
      }
    };

    // Lê imediatamente
    await readValue();

    // Configura leitura periódica apenas se ainda estiver monitorando
    if (isMonitoring) {
      intervalId = setInterval(readValue, intervalMs);
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (onMessage) {
      onMessage(`⚠️ Não foi possível iniciar monitoramento: ${errorMsg}`);
    }
    stopMonitoring();
  }

  return () => {
    stopMonitoring();
    if (onMessage) {
      onMessage(`🛑 Monitoramento parado`);
    }
  };
}

