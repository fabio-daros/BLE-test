import type { Device } from 'react-native-ble-plx';
import {
  BATTERY_STATS_SERVICE_UUID,
  STATUS_BATERIA_UUID,
  parseBatteryStatusFromBase64,
} from './batteryStatsProtocol';
import { readCharacteristic, createPeriodicMonitor } from '../core';

export interface BatteryStatsSubscriptions {
  stop: () => void;
}

/**
 * Lê o status atual da bateria (característica READ)
 */
export async function readBatteryStatus(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<number | null> {
  const value = await readCharacteristic(device, {
    serviceUuid: BATTERY_STATS_SERVICE_UUID,
    characteristicUuid: STATUS_BATERIA_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return null;
  }

  const status = parseBatteryStatusFromBase64(value);
  if (!status) {
    onMessage('⚠️ Não foi possível fazer parse do status da bateria');
    return null;
  }

  const byte1Hex = status.rawBytes[0]!.toString(16).padStart(2, '0');
  const byte2Hex = status.rawBytes.length >= 2
    ? status.rawBytes[1]!.toString(16).padStart(2, '0')
    : '00';
  const bytesStr = status.rawBytes.length >= 2
    ? `[0x${byte1Hex}, 0x${byte2Hex}]`
    : `[0x${byte1Hex}]`;

  onMessage(
    `✅ Status da Bateria: ${status.percentage}% | ` +
      `Hex: ${status.hexValue} | ` +
      `Bytes: ${bytesStr}`,
  );
  return status.percentage;
}

/**
 * Monitora o status da bateria (leitura periódica)
 */
export async function monitorBatteryStatus(
  device: Device,
  onMessage: (msg: string) => void,
  onBatteryUpdate?: (percentage: number) => void,
  intervalMs: number = 5000,
): Promise<() => void> {
  return createPeriodicMonitor({
    device,
    readOptions: {
      serviceUuid: BATTERY_STATS_SERVICE_UUID,
      characteristicUuid: STATUS_BATERIA_UUID,
      onMessage,
      silentOnConnectionError: true,
    },
    onUpdate: async (value) => {
      if (!value) return;
      const status = parseBatteryStatusFromBase64(value);
      if (status) {
        onMessage(
          `📊 Bateria: ${status.percentage}% | RAW: ${value} | Hex: ${status.hexValue}`,
        );
        if (onBatteryUpdate) {
          onBatteryUpdate(status.percentage);
        }
      }
    },
    intervalMs,
    onMessage,
  });
}

/**
 * Anexa monitoramento do status da bateria
 */
export async function attachBatteryStatsMonitors(
  device: Device,
  onMessage: (msg: string) => void,
  onBatteryUpdate?: (percentage: number) => void,
): Promise<BatteryStatsSubscriptions> {
  const stopFunctions: Array<() => void> = [];

  try {
    onMessage('🚀 attachBatteryStatsMonitors chamado!');
    onMessage(`🔍 Service UUID: ${BATTERY_STATS_SERVICE_UUID}`);
    onMessage('=== Iniciando monitoramento do status da bateria ===');

    // 1. Leitura inicial do status (READ)
    await readBatteryStatus(device, onMessage);

    // 2. Monitora status da bateria (leitura periódica)
    try {
      const stopMonitor = await monitorBatteryStatus(
        device,
        onMessage,
        onBatteryUpdate,
      );
      stopFunctions.push(stopMonitor);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar status da bateria: ${error?.message || String(error)}`,
      );
    }

    onMessage('✅ Monitoramento do status da bateria foi anexado');

    return {
      stop: () => {
        onMessage('🛑 Parando monitoramento da bateria...');
        stopFunctions.forEach(stop => {
          try {
            stop();
          } catch (e) {
            // ignore
          }
        });
        onMessage('✅ Monitoramento da bateria finalizado');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitoramento da bateria: ${error?.message || String(error)}`,
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

export function detachBatteryStatsMonitors(
  subs: BatteryStatsSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitoramento da bateria: ${e?.message || String(e)}`);
  }
}
