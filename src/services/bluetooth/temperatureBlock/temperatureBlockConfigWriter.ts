import type { Device } from 'react-native-ble-plx';
import { TEMPERATURE_BLOCK_SERVICE_UUID } from './temperatureBlockProtocol';
import {
  CONFIGURA_BLOCO_UUID,
  buildTemperatureBlockConfigPayload,
  type TemperatureBlockConfigInput,
  type TemperatureBlockTestType,
} from './temperatureBlockConfigProtocol';

export type { TemperatureBlockTestType };

export interface TemperatureBlockConfigResult {
  success: boolean;
  type: TemperatureBlockTestType;
  temperature: number;
  reactionTimeMinutes: number;
  hex: string;
  bytes: [number, number];
}

export async function writeTemperatureBlockConfig(
  device: Device,
  onMessage: (msg: string) => void,
  input: TemperatureBlockConfigInput,
): Promise<TemperatureBlockConfigResult | null> {
  try {
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando configuração do bloco');
      return null;
    }

    const payload = buildTemperatureBlockConfigPayload(input);

    onMessage(
      `✍️ Enviando configuração do bloco (${input.testType}) | Temp: ${input.temperatureCelsius}°C | Tempo reação: ${input.reactionTimeMinutes} min | Hex: ${payload.hex}`,
    );

    await device.writeCharacteristicWithResponseForService(
      TEMPERATURE_BLOCK_SERVICE_UUID,
      CONFIGURA_BLOCO_UUID,
      payload.base64,
    );

    onMessage(
      `✅ Configuração do bloco enviada com sucesso | Bytes: [0x${payload.bytes[0]
        .toString(16)
        .padStart(2, '0')}, 0x${payload.bytes[1]
        .toString(16)
        .padStart(2, '0')}]`,
    );

    return {
      success: true,
      type: input.testType,
      temperature: input.temperatureCelsius,
      reactionTimeMinutes: input.reactionTimeMinutes,
      hex: payload.hex,
      bytes: payload.bytes,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error) || '';
    const errorString = errorMsg.toLowerCase();

    if (
      errorMsg.includes('GATT_ERROR') ||
      errorMsg.includes('status 133') ||
      errorMsg.includes('0x85') ||
      errorMsg.includes('not connected') ||
      errorMsg.includes('disconnected') ||
      errorString.includes('gatt') ||
      errorString.includes('ble') ||
      errorString.includes('nullpointerexception')
    ) {
      onMessage('⚠️ Erro de conexão ao configurar bloco (ignorado)');
      return null;
    }

    onMessage(`❌ Erro ao configurar bloco: ${errorMsg}`);
    return null;
  }
}

