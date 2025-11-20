import type { Device } from 'react-native-ble-plx';
import {
  EQUIPMENT_STATUS_SERVICE_UUID,
  STATUS_DISPOSITIVO_UUID,
  parseEquipmentStatusFromBase64,
  getEquipmentStatusDescription,
  type EquipmentStatusType,
} from './equipmentStatusProtocol';
import { readCharacteristic, createPeriodicMonitor } from '../core';

export type { EquipmentStatusType };

export interface EquipmentStatusSubscriptions {
  stop: () => void;
}

/**
 * Lê o status atual do equipamento (característica READ)
 */
export async function readEquipmentStatus(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<EquipmentStatusType | null> {
  const value = await readCharacteristic(device, {
    serviceUuid: EQUIPMENT_STATUS_SERVICE_UUID,
    characteristicUuid: STATUS_DISPOSITIVO_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return null;
  }

  const status = parseEquipmentStatusFromBase64(value);
  if (!status) {
    onMessage('⚠️ Não foi possível fazer parse do status do equipamento');
    return null;
  }

  const description = getEquipmentStatusDescription(status.status);
  onMessage(
    `✅ Status do Equipamento: ${description} | ` +
      `Hex: ${status.hexValue} | ` +
      `Byte: 0x${status.rawByte.toString(16).padStart(2, '0')}`,
  );

  return status.status;
}

/**
 * Monitora o status do equipamento (leitura periódica)
 */
export async function monitorEquipmentStatus(
  device: Device,
  onMessage: (msg: string) => void,
  onStatusUpdate?: (status: EquipmentStatusType) => void,
  intervalMs: number = 5000,
): Promise<() => void> {
  return createPeriodicMonitor({
    device,
    readOptions: {
      serviceUuid: EQUIPMENT_STATUS_SERVICE_UUID,
      characteristicUuid: STATUS_DISPOSITIVO_UUID,
      onMessage,
      silentOnConnectionError: true,
    },
    onUpdate: async (value) => {
      if (!value) return;
      const status = parseEquipmentStatusFromBase64(value);
      if (status && onStatusUpdate) {
        onStatusUpdate(status.status);
      }
    },
    intervalMs,
    onMessage,
  });
}

/**
 * Anexa monitoramento do status do equipamento
 */
export async function attachEquipmentStatusMonitors(
  device: Device,
  onMessage: (msg: string) => void,
  onStatusUpdate?: (status: EquipmentStatusType) => void,
): Promise<EquipmentStatusSubscriptions> {
  const stopFunctions: Array<() => void> = [];

  try {
    onMessage('🚀 attachEquipmentStatusMonitors chamado!');
    onMessage(`🔍 Service UUID: ${EQUIPMENT_STATUS_SERVICE_UUID}`);
    onMessage('=== Iniciando monitoramento do status do equipamento ===');

    // 1. Leitura inicial do status (READ)
    await readEquipmentStatus(device, onMessage);

    // 2. Monitora status do equipamento (leitura periódica)
    try {
      const stopMonitor = await monitorEquipmentStatus(
        device,
        onMessage,
        onStatusUpdate,
      );
      stopFunctions.push(stopMonitor);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar status do equipamento: ${error?.message || String(error)}`,
      );
    }

    onMessage('✅ Monitoramento do status do equipamento foi anexado');

    return {
      stop: () => {
        onMessage('🛑 Parando monitoramento do status do equipamento...');
        stopFunctions.forEach(stop => {
          try {
            stop();
          } catch (e) {
            // ignore
          }
        });
        onMessage('✅ Monitoramento do status do equipamento finalizado');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitoramento do status do equipamento: ${error?.message || String(error)}`,
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

export function detachEquipmentStatusMonitors(
  subs: EquipmentStatusSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitoramento do status do equipamento: ${e?.message || String(e)}`);
  }
}

