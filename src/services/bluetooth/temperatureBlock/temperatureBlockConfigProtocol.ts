import { bytesToBase64 } from '../core/utils';

export const CONFIGURA_BLOCO_UUID =
  'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // WRITE - Configurar temperatura e tipo de teste

export type TemperatureBlockTestType = 'colorimetric' | 'fluorimetric';

export interface TemperatureBlockConfigInput {
  temperatureCelsius: number; // 0-127
  reactionTimeMinutes: number; // 0-255
  testType: TemperatureBlockTestType;
}

export interface TemperatureBlockConfigPayload {
  bytes: [number, number];
  base64: string;
  hex: string;
}

export function buildTemperatureBlockConfigPayload(
  input: TemperatureBlockConfigInput,
): TemperatureBlockConfigPayload {
  const clampedTemperature = Math.max(0, Math.min(127, Math.round(input.temperatureCelsius)));
  const clampedReaction = Math.max(0, Math.min(255, Math.round(input.reactionTimeMinutes)));
  const typeBit = input.testType === 'fluorimetric' ? 1 : 0;
  const byte1 = (typeBit << 7) | (clampedTemperature & 0b01111111);
  const byte2 = clampedReaction & 0xff;
  const bytes: [number, number] = [byte1, byte2];
  const base64 = bytesToBase64(bytes);
  const hex = `0x${byte1.toString(16).padStart(2, '0').toUpperCase()}${byte2
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}`;

  return {
    bytes,
    base64,
    hex,
  };
}

