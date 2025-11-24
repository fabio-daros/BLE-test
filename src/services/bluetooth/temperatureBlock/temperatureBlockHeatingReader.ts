import type { Device } from 'react-native-ble-plx';
import { TEMPERATURE_BLOCK_SERVICE_UUID } from './temperatureBlockProtocol';
import {
  TEMPO_AQUECIMENTO_BLOCO_UUID,
  parseHeatingTimeFromBase64,
  type TemperatureBlockHeatingTimeStatus,
} from './temperatureBlockHeatingProtocol';
import { readCharacteristic, createPeriodicMonitor } from '../core';
import { base64ToBytes } from '../core/utils';

export async function readTemperatureBlockHeatingTime(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<TemperatureBlockHeatingTimeStatus | null> {
  const value = await readCharacteristic(device, {
    serviceUuid: TEMPERATURE_BLOCK_SERVICE_UUID,
    characteristicUuid: TEMPO_AQUECIMENTO_BLOCO_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return null;
  }

  const status = parseHeatingTimeFromBase64(value);
  if (!status) {
    onMessage('⚠️ Não foi possível fazer parse do tempo de aquecimento do bloco');
    return null;
  }

  const [hourByte, minuteByte] = status.rawBytes;
  const bytesStr = `[0x${hourByte!.toString(16).padStart(2, '0')}, 0x${minuteByte!
    .toString(16)
    .padStart(2, '0')}]`;

  onMessage(
    `✅ Tempo de aquecimento do bloco: ${status.hours}h${status.minutes
      .toString()
      .padStart(2, '0')} (total ${status.totalMinutes} minutos) | Hex: ${
      status.hexValue
    } | Bytes: ${bytesStr}`,
  );

  return status;
}

export async function monitorTemperatureBlockHeatingTime(
  device: Device,
  onMessage: (msg: string) => void,
  onHeatingTimeUpdate?: (status: TemperatureBlockHeatingTimeStatus) => void,
  intervalMs: number = 5000,
): Promise<() => void> {
  return createPeriodicMonitor({
    device,
    readOptions: {
      serviceUuid: TEMPERATURE_BLOCK_SERVICE_UUID,
      characteristicUuid: TEMPO_AQUECIMENTO_BLOCO_UUID,
      onMessage,
      silentOnConnectionError: true,
    },
    onUpdate: async (value) => {
      if (!value) return;
      
      // Log detalhado do raw para debug
      const bytes = base64ToBytes(value);
      console.log('[DEBUG] Tempo Aquecimento - Base64:', value);
      console.log('[DEBUG] Tempo Aquecimento - Bytes:', bytes);
      console.log('[DEBUG] Tempo Aquecimento - Hex:', bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      console.log('[DEBUG] Tempo Aquecimento - Tamanho:', bytes.length, 'bytes');
      
      const status = parseHeatingTimeFromBase64(value);
      
      if (status) {
        // Mensagem simplificada - apenas mostra o valor
        const timeStr = `${status.hours}h${status.minutes.toString().padStart(2, '0')}`;
        
        // Se for zero, adiciona aviso (mas não mostra mensagem repetitiva se já sabemos que é zero)
        // O hardware tem mostrado comportamento de sempre enviar 0x0000 após iniciar análise
        if (status.totalMinutes === 0) {
          // Log apenas no console para não poluir as mensagens do usuário
          console.warn('[DEBUG] ⚠️ Tempo de aquecimento está zerado. Hardware pode ter resetado após iniciar análise.');
          // Mostra mensagem simplificada sem aviso repetitivo
          onMessage(`📊 Aquecimento: ${timeStr} (${status.totalMinutes}min) | Hex: ${status.hexValue}`);
        } else {
          onMessage(`📊 Aquecimento: ${timeStr} (${status.totalMinutes}min) | Hex: ${status.hexValue}`);
        }
        
        if (onHeatingTimeUpdate) {
          onHeatingTimeUpdate(status);
        }
      } else {
        console.error('[DEBUG] ⚠️ Parse falhou! Base64:', value, 'Bytes:', bytes);
        onMessage(`⚠️ Não foi possível fazer parse do tempo de aquecimento | RAW: ${value}`);
      }
    },
    intervalMs,
    onMessage,
  });
}
