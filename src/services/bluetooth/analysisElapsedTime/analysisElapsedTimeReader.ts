import type { Device } from 'react-native-ble-plx';
import { TEMPERATURE_BLOCK_SERVICE_UUID } from '../temperatureBlock/temperatureBlockProtocol';
import {
  ANALYSIS_ELAPSED_TIME_UUID,
  parseAnalysisElapsedTimeFromBase64,
  type AnalysisElapsedTimeStatus,
} from './analysisElapsedTimeProtocol';
import { readCharacteristic, createPeriodicMonitor } from '../core';
import { base64ToBytes } from '../core/utils';

export async function readAnalysisElapsedTime(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<AnalysisElapsedTimeStatus | null> {
  const value = await readCharacteristic(device, {
    serviceUuid: TEMPERATURE_BLOCK_SERVICE_UUID,
    characteristicUuid: ANALYSIS_ELAPSED_TIME_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return null;
  }

  const status = parseAnalysisElapsedTimeFromBase64(value);
  if (!status) {
    onMessage('⚠️ Não foi possível fazer parse do tempo decorrido da análise');
    return null;
  }

  const [hourByte, minuteByte] = status.rawBytes;
  const bytesStr = `[0x${hourByte!.toString(16).padStart(2, '0')}, 0x${minuteByte!
    .toString(16)
    .padStart(2, '0')}]`;

  onMessage(
    `✅ Tempo decorrido da análise: ${status.hours}h${status.minutes
      .toString()
      .padStart(2, '0')} (total ${status.totalMinutes} minutos) | Hex: ${
      status.hexValue
    } | Bytes: ${bytesStr}`,
  );

  return status;
}

export async function monitorAnalysisElapsedTime(
  device: Device,
  onMessage: (msg: string) => void,
  onElapsedTimeUpdate?: (status: AnalysisElapsedTimeStatus) => void,
  intervalMs: number = 5000,
): Promise<() => void> {
  return createPeriodicMonitor({
    device,
    readOptions: {
      serviceUuid: TEMPERATURE_BLOCK_SERVICE_UUID,
      characteristicUuid: ANALYSIS_ELAPSED_TIME_UUID,
      onMessage,
      silentOnConnectionError: true,
    },
    onUpdate: async (value) => {
      if (!value) return;
      
      // Log detalhado do raw para debug
      const bytes = base64ToBytes(value);
      console.log('[DEBUG] Tempo Decorrido Análise - Base64:', value);
      console.log('[DEBUG] Tempo Decorrido Análise - Bytes:', bytes);
      console.log('[DEBUG] Tempo Decorrido Análise - Hex:', bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      console.log('[DEBUG] Tempo Decorrido Análise - Tamanho:', bytes.length, 'bytes');
      
      const status = parseAnalysisElapsedTimeFromBase64(value);
      
      if (status) {
        // Mensagem simplificada - apenas mostra o valor
        const timeStr = `${status.hours}h${status.minutes.toString().padStart(2, '0')}`;
        onMessage(`📊 Tempo decorrido: ${timeStr} (${status.totalMinutes}min) | Hex: ${status.hexValue}`);
        
        if (onElapsedTimeUpdate) {
          onElapsedTimeUpdate(status);
        }
      } else {
        // Se receber apenas 1 byte, o hardware está retornando status em vez de tempo decorrido
        // Isso é uma discrepância com a documentação - o hardware deveria retornar 2 bytes
        if (bytes.length === 1) {
          console.warn('[DEBUG] ⚠️ Hardware retornou apenas 1 byte (status) em vez de 2 bytes (tempo decorrido). Discrepância com documentação.');
          // Não mostra erro ao usuário, apenas log no console
        } else {
          console.error('[DEBUG] ⚠️ Parse falhou! Base64:', value, 'Bytes:', bytes);
          onMessage(`⚠️ Não foi possível fazer parse do tempo decorrido | RAW: ${value}`);
        }
      }
    },
    intervalMs,
    onMessage,
  });
}

