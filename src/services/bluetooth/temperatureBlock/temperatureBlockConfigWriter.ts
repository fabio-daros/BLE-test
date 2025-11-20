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

const toBinary = (value: number, width: number) =>
  value.toString(2).padStart(width, '0');

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
    const typeBit = payload.bytes[0] >> 7;
    const temperatureBits = toBinary(payload.bytes[0] & 0b01111111, 7);
    const byte1Binary = toBinary(payload.bytes[0], 8);
    const byte2Binary = toBinary(payload.bytes[1], 8);
    const reactionBits = toBinary(payload.bytes[1], 8);

    onMessage(
      `[config bloco] temp ${payload.bytes[0] & 0b01111111}°C -> bits ${temperatureBits} | ` +
        `tipo ${input.testType} -> bit ${typeBit} | tempo ${payload.bytes[1]}min -> bits ${reactionBits} | ` +
        `Byte1 (tipo+temp): ${byte1Binary} | Byte2 (tempo): ${byte2Binary}`,
    );

    onMessage(`✍️ Enviando configuração do bloco (${input.testType}) | Hex ${payload.hex}`);

    await device.writeCharacteristicWithResponseForService(
      TEMPERATURE_BLOCK_SERVICE_UUID,
      CONFIGURA_BLOCO_UUID,
      payload.base64,
    );

    onMessage(
      `✅ Configuração aplicada | Bytes [0x${payload.bytes[0]
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

