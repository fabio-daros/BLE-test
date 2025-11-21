import { base64ToBytes, bytesToBase64 } from '../core/utils';

// UUIDs do hardware conforme documentação
export const TEMPERATURE_BLOCK_SERVICE_UUID =
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b'; // Mesmo serviço do pré-teste

// Característica da temperatura do bloco
export const TEMPERATURA_BLOCO_UUID = 'df60fccb-9b33-4492-a633-e68e7df3c58d'; // READ - Indica a temperatura atual do bloco

// --------- Tipos de alto nível ---------

export interface TemperatureBlockStatus {
  rawBytes: number[]; // 4 bytes (float32 big-endian)
  temperature: number; // Temperatura em graus Celsius (float32)
  isPositive: boolean;
  hexValue: string; // Valor em hexadecimal
}

// Re-exportar utilitários para compatibilidade
export { base64ToBytes, bytesToBase64 };


// --------- Parsing da TEMPERATURA do bloco ---------

/**
 * Protocolo (conforme firmware):
 *  - valor float32 (4 bytes) enviado em big-endian
 */
export function parseTemperatureBlockFromBase64(
  value: string | null | undefined,
): TemperatureBlockStatus | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 4) return null;

  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  const uint = new Uint8Array(buf);
  uint[0] = bytes[0]!;
  uint[1] = bytes[1]!;
  uint[2] = bytes[2]!;
  uint[3] = bytes[3]!;
  const temperature = view.getFloat32(0, false); // big-endian

  const hexValue = `0x${bytes
    .slice(0, 4)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`;

  return {
    rawBytes: bytes.slice(0, 4),
    temperature,
    isPositive: temperature >= 0,
    hexValue,
  };
}

