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

/**
 * Constrói o payload de configuração do bloco de temperatura conforme protocolo:
 * 
 * 2 Bytes:
 * - Byte 1:
 *   - Bit 0-7: temperatura (bits 0-6 em índice 0-based, max 127°C)
 *   - Bit 8: tipo de teste (bit 7 em índice 0-based: 0=colorimétrica, 1=fluorimétrica)
 * - Byte 2: tempo de reação em minutos (max 255 minutos)
 * 
 * Exemplo: 0xA50F
 * - Byte 1: 0xA5 = 10100101
 *   - Bit 8 (bit 7): 1 = Fluorimétrica
 *   - Bits 1-7 (bits 0-6): 0100101 = 37 graus
 * - Byte 2: 0x0F = 15 minutos
 */
export function buildTemperatureBlockConfigPayload(
  input: TemperatureBlockConfigInput,
): TemperatureBlockConfigPayload {
  const clampedTemperature = Math.max(0, Math.min(127, Math.round(input.temperatureCelsius)));
  const clampedReaction = Math.max(0, Math.min(255, Math.round(input.reactionTimeMinutes)));
  // Bit 8 (bit 7 em 0-based): 0=colorimétrica, 1=fluorimétrica
  const typeBit = input.testType === 'fluorimetric' ? 1 : 0;
  // Byte 1: bit 7 = tipo, bits 0-6 = temperatura
  const byte1 = (typeBit << 7) | (clampedTemperature & 0b01111111);
  // Byte 2: tempo de reação em minutos
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

