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

  // Log detalhado para o desenvolvedor do hardware - conversão big-endian
  const bytes = base64ToBytes(value);
  const bytesHex = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
  const bytesArray = `[${bytes.map(b => b.toString()).join(', ')}]`;

  console.log('[DEBUG Hardware - Tempo Aquecimento] Base64 recebido:', value);
  console.log('[DEBUG Hardware - Tempo Aquecimento] Bytes decodificados:', bytesArray);
  console.log('[DEBUG Hardware - Tempo Aquecimento] Bytes em hex:', bytesHex);
  console.log('[DEBUG Hardware - Tempo Aquecimento] Tamanho do buffer:', bytes.length, 'bytes');

  // Só tenta ler como float32 se tiver pelo menos 4 bytes
  if (bytes.length >= 4) {
    const buffer = new ArrayBuffer(bytes.length);
    const view = new DataView(buffer);
    bytes.forEach((byte, index) => {
      view.setUint8(index, byte);
    });

    const floatBigEndian = view.getFloat32(0, false);
    const floatLittleEndian = view.getFloat32(0, true);

    console.log('[DEBUG Hardware - Tempo Aquecimento] Float32 BIG-ENDIAN:', floatBigEndian);
    console.log('[DEBUG Hardware - Tempo Aquecimento] Float32 LITTLE-ENDIAN (comparação):', floatLittleEndian);
    console.log('[DEBUG Hardware - Tempo Aquecimento] Valor (big-endian):', floatBigEndian.toFixed(2));
  } else {
    console.log('[DEBUG Hardware - Tempo Aquecimento] Buffer muito pequeno para float32 (precisa de 4 bytes, recebeu', bytes.length, ')');
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
      const status = parseHeatingTimeFromBase64(value);
      if (status) {
        onMessage(
          `📊 Aquecimento: ${status.hours}h${status.minutes.toString().padStart(2, '0')} (${status.totalMinutes}min) | RAW: ${value} | Hex: ${status.hexValue}`,
        );
        if (onHeatingTimeUpdate) {
          onHeatingTimeUpdate(status);
        }
      }
    },
    intervalMs,
    onMessage,
  });
}
