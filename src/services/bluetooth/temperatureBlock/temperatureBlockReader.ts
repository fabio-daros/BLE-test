import type { Device } from 'react-native-ble-plx';
import {
  TEMPERATURE_BLOCK_SERVICE_UUID,
  TEMPERATURA_BLOCO_UUID,
  parseTemperatureBlockFromBase64,
} from './temperatureBlockProtocol';
import type { TemperatureBlockHeatingTimeStatus } from './temperatureBlockHeatingProtocol';
import {
  readTemperatureBlockHeatingTime,
  monitorTemperatureBlockHeatingTime,
} from './temperatureBlockHeatingReader';
import { readCharacteristic, createPeriodicMonitor } from '../core';

export {
  readTemperatureBlockHeatingTime,
  monitorTemperatureBlockHeatingTime,
};
export type { TemperatureBlockHeatingTimeStatus };

export interface TemperatureBlockSubscriptions {
  stop: () => void;
}

/**
 * Lê a temperatura atual do bloco (característica READ)
 */
export async function readTemperatureBlock(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<number | null> {
  const value = await readCharacteristic(device, {
    serviceUuid: TEMPERATURE_BLOCK_SERVICE_UUID,
    characteristicUuid: TEMPERATURA_BLOCO_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return null;
  }

  const status = parseTemperatureBlockFromBase64(value);
  if (!status) {
    onMessage('⚠️ Não foi possível fazer parse da temperatura do bloco');
    return null;
  }

  const byte1Hex = status.rawBytes[0]!.toString(16).padStart(2, '0');
  const byte2Hex = status.rawBytes.length >= 2
    ? status.rawBytes[1]!.toString(16).padStart(2, '0')
    : '00';
  const bytesStr = status.rawBytes.length >= 2
    ? `[0x${byte1Hex}, 0x${byte2Hex}]`
    : `[0x${byte1Hex}]`;

  const signStr = status.isPositive ? '+' : '-';
  onMessage(
    `✅ Temperatura do Bloco: ${signStr}${status.temperature}°C | ` +
      `Hex: ${status.hexValue} | ` +
      `Bytes: ${bytesStr} | ` +
      `Sinal: ${status.isPositive ? 'Positivo' : 'Negativo'}`,
  );
  return status.temperature;
}

/**
 * Monitora a temperatura do bloco (leitura periódica)
 */
export async function monitorTemperatureBlock(
  device: Device,
  onMessage: (msg: string) => void,
  onTemperatureUpdate?: (temperature: number) => void,
  intervalMs: number = 5000,
): Promise<() => void> {
  return createPeriodicMonitor({
    device,
    readOptions: {
      serviceUuid: TEMPERATURE_BLOCK_SERVICE_UUID,
      characteristicUuid: TEMPERATURA_BLOCO_UUID,
      onMessage,
      silentOnConnectionError: true,
    },
    onUpdate: async (value) => {
      if (!value) return;
      const status = parseTemperatureBlockFromBase64(value);
      if (status && onTemperatureUpdate) {
        onTemperatureUpdate(status.temperature);
      }
    },
    intervalMs,
    onMessage,
  });
}

/**
 * Anexa monitoramento da temperatura do bloco
 */
export async function attachTemperatureBlockMonitors(
  device: Device,
  onMessage: (msg: string) => void,
  onTemperatureUpdate?: (temperature: number) => void,
  onHeatingTimeUpdate?: (status: TemperatureBlockHeatingTimeStatus) => void,
): Promise<TemperatureBlockSubscriptions> {
  const stopFunctions: Array<() => void> = [];

  try {
    onMessage('🚀 attachTemperatureBlockMonitors chamado!');
    onMessage(`🔍 Service UUID: ${TEMPERATURE_BLOCK_SERVICE_UUID}`);
    onMessage('=== Iniciando monitoramento da temperatura do bloco ===');

    // 1. Leitura inicial da temperatura (READ)
    await readTemperatureBlock(device, onMessage);

    // 2. Leitura inicial do tempo de aquecimento (READ)
    await readTemperatureBlockHeatingTime(device, onMessage);

    // 3. Monitora temperatura do bloco (leitura periódica)
    try {
      const stopMonitor = await monitorTemperatureBlock(
        device,
        onMessage,
        onTemperatureUpdate,
      );
      stopFunctions.push(stopMonitor);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar temperatura do bloco: ${error?.message || String(error)}`,
      );
    }

    // 4. Monitora tempo de aquecimento
    try {
      const stopMonitorHeating = await monitorTemperatureBlockHeatingTime(
        device,
        onMessage,
        onHeatingTimeUpdate,
      );
      stopFunctions.push(stopMonitorHeating);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar tempo de aquecimento do bloco: ${error?.message || String(error)}`,
      );
    }

    onMessage('✅ Monitoramentos do bloco foram anexados');

    return {
      stop: () => {
        onMessage('🛑 Parando monitoramento da temperatura...');
        stopFunctions.forEach(stop => {
          try {
            stop();
          } catch (e) {
            // ignore
          }
        });
        onMessage('✅ Monitoramento da temperatura finalizado');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitoramento da temperatura: ${error?.message || String(error)}`,
    );

    // Limpa tudo em caso de erro
    stopFunctions.forEach(stop => {
      try {
        stop();
      } catch (e) {
        // ignore
      }
    });

    return {
      stop: () => {
        onMessage('Monitoramento já foi limpo devido a erro');
      },
    };
  }
}

export function detachTemperatureBlockMonitors(
  subs: TemperatureBlockSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitoramento da temperatura: ${e?.message || String(e)}`);
  }
}
