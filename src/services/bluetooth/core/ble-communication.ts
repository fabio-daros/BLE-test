import type { Device } from 'react-native-ble-plx';
import { isGattConnectionError } from './utils';

/**
 * Camada de comunicação BLE genérica
 * Centraliza todas as operações de leitura, escrita e monitoramento
 */

export interface ReadCharacteristicOptions {
  serviceUuid: string;
  characteristicUuid: string;
  onMessage?: (msg: string) => void;
  silentOnConnectionError?: boolean;
}

export interface WriteCharacteristicOptions {
  serviceUuid: string;
  characteristicUuid: string;
  value: string; // base64
  onMessage?: (msg: string) => void;
  silentOnConnectionError?: boolean;
}

export interface MonitorCharacteristicOptions {
  serviceUuid: string;
  characteristicUuid: string;
  onData: (value: string | null) => void;
  onMessage?: (msg: string) => void;
  silentOnConnectionError?: boolean;
}

/**
 * Verifica se o dispositivo está conectado
 */
export async function checkConnection(
  device: Device,
  onMessage?: (msg: string) => void,
): Promise<boolean> {
  try {
    return await device.isConnected();
  } catch (error: any) {
    if (onMessage && !isGattConnectionError(error)) {
      onMessage(`⚠️ Erro ao verificar conexão: ${error?.message || String(error)}`);
    }
    return false;
  }
}

/**
 * Lê uma característica BLE de forma segura
 */
export async function readCharacteristic(
  device: Device,
  options: ReadCharacteristicOptions,
): Promise<string | null> {
  const {
    serviceUuid,
    characteristicUuid,
    onMessage,
    silentOnConnectionError = false,
  } = options;

  try {
    // Verifica conexão antes de ler
    const isConnected = await checkConnection(device, onMessage);
    if (!isConnected) {
      if (onMessage && !silentOnConnectionError) {
        onMessage('⚠️ Dispositivo não está conectado');
      }
      return null;
    }

    if (onMessage) {
      onMessage(`📖 Lendo característica (UUID: ${characteristicUuid})...`);
    }

    let characteristic;
    try {
      characteristic = await device.readCharacteristicForService(
        serviceUuid,
        characteristicUuid,
      );
    } catch (readError: any) {
      if (isGattConnectionError(readError)) {
        if (onMessage && !silentOnConnectionError) {
          onMessage('⚠️ Erro de conexão ao ler característica');
        }
        return null;
      }
      throw readError;
    }

    const value = characteristic.value;
    if (onMessage) {
      onMessage(`📊 Valor RAW (base64): ${value || 'null'}`);
    }

    return value || null;
  } catch (error: any) {
    if (isGattConnectionError(error)) {
      if (onMessage && !silentOnConnectionError) {
        onMessage('⚠️ Erro de conexão ao ler característica');
      }
      return null;
    }

    if (onMessage) {
      onMessage(`❌ Erro ao ler característica: ${error?.message || String(error)}`);
    }
    return null;
  }
}

/**
 * Escreve uma característica BLE de forma segura
 */
export async function writeCharacteristic(
  device: Device,
  options: WriteCharacteristicOptions,
): Promise<boolean> {
  const {
    serviceUuid,
    characteristicUuid,
    value,
    onMessage,
    silentOnConnectionError = false,
  } = options;

  try {
    // Verifica conexão antes de escrever
    const isConnected = await checkConnection(device, onMessage);
    if (!isConnected) {
      if (onMessage && !silentOnConnectionError) {
        onMessage('⚠️ Dispositivo não está conectado');
      }
      return false;
    }

    if (onMessage) {
      onMessage(`✍️ Escrevendo característica (UUID: ${characteristicUuid})...`);
    }

    await device.writeCharacteristicWithResponseForService(
      serviceUuid,
      characteristicUuid,
      value,
    );

    if (onMessage) {
      onMessage(`✅ Característica escrita com sucesso`);
    }

    return true;
  } catch (error: any) {
    if (isGattConnectionError(error)) {
      if (onMessage && !silentOnConnectionError) {
        onMessage('⚠️ Erro de conexão ao escrever característica');
      }
      return false;
    }

    if (onMessage) {
      onMessage(`❌ Erro ao escrever característica: ${error?.message || String(error)}`);
    }
    return false;
  }
}

/**
 * Verifica se uma característica existe e é notificável
 */
export async function checkCharacteristicExists(
  device: Device,
  serviceUuid: string,
  characteristicUuid: string,
  name: string,
  onMessage?: (msg: string) => void,
): Promise<boolean> {
  try {
    const services = await device.services();
    const service = services.find(s => s.uuid.toLowerCase() === serviceUuid.toLowerCase());

    if (!service) {
      if (onMessage) {
        onMessage(`⚠️ Serviço não encontrado para ${name}`);
      }
      return false;
    }

    const characteristics = await service.characteristics();
    const characteristic = characteristics.find(
      c => c.uuid.toLowerCase() === characteristicUuid.toLowerCase(),
    );

    if (!characteristic) {
      if (onMessage) {
        onMessage(`⚠️ Característica não encontrada para ${name}`);
      }
      return false;
    }

    if (!characteristic.isNotifiable) {
      if (onMessage) {
        onMessage(`⚠️ ${name} não é notificável (apenas READ disponível)`);
      }
      return false;
    }

    if (onMessage) {
      onMessage(`✅ ${name} encontrada e é notificável`);
    }
    return true;
  } catch (error: any) {
    if (onMessage) {
      onMessage(`⚠️ Erro ao verificar ${name}: ${error?.message || String(error)}`);
    }
    return false;
  }
}

/**
 * Monitora notificações de uma característica de forma segura
 */
export async function monitorCharacteristic(
  device: Device,
  options: MonitorCharacteristicOptions,
): Promise<() => void> {
  const {
    serviceUuid,
    characteristicUuid,
    onData,
    onMessage,
    silentOnConnectionError = false,
  } = options;

  let subscription: any = null;

  try {
    // Verifica se a característica existe e é notificável
    const canMonitor = await checkCharacteristicExists(
      device,
      serviceUuid,
      characteristicUuid,
      'Característica',
      onMessage,
    );

    if (!canMonitor) {
      return () => {
        // Nada para limpar
      };
    }

    if (onMessage) {
      onMessage(`🔔 Iniciando monitoramento de característica...`);
    }

    subscription = device.monitorCharacteristicForService(
      serviceUuid,
      characteristicUuid,
      (error, characteristic) => {
        if (error) {
          if (onMessage) {
            onMessage(`❌ Erro no monitoramento: ${error?.message || String(error)}`);
          }
          return;
        }

        const value = characteristic?.value || null;
        if (onMessage) {
          onMessage(`🔔 Notificação recebida (base64): ${value || 'null'}`);
        }

        onData(value);
      },
    );

    if (onMessage) {
      onMessage(`✅ Monitoramento iniciado com sucesso`);
    }
  } catch (error: any) {
    if (onMessage) {
      if (isGattConnectionError(error) && !silentOnConnectionError) {
        onMessage(`⚠️ Erro de conexão ao iniciar monitoramento`);
      } else {
        onMessage(`⚠️ Não foi possível iniciar monitoramento: ${error?.message || String(error)}`);
      }
    }
  }

  return () => {
    if (subscription) {
      try {
        subscription.remove();
        if (onMessage) {
          onMessage(`🛑 Monitoramento parado`);
        }
      } catch (e) {
        // Ignora erros ao remover subscription
      }
    }
  };
}

