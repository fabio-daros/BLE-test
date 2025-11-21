import { base64ToBytes } from '../core/utils';

// UUIDs do hardware conforme documentação
export const BATTERY_STATS_SERVICE_UUID =
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b'; // Mesmo serviço do pré-teste

// Característica do status da bateria
export const STATUS_BATERIA_UUID = '906d7ba4-d34c-4f2c-8633-c08239c4a432'; // READ - Indica a porcentagem da bateria

// --------- Tipos de alto nível ---------

export interface BatteryStatus {
  rawBytes: number[]; // 2 bytes em hexadecimal
  percentage: number; // 0 a 100
  hexValue: string; // Valor em hexadecimal (ex: "0x64")
}

// --------- Parsing do STATUS da bateria ---------

/**
 * Protocolo (conforme documentação e imagem):
 *  - 2 bytes em hexadecimal
 *  - 0x0 a 0x64 (0 a 100 em decimal)
 *  - Representa a porcentagem da bateria de 0% a 100%
 * 
 * Nota: A documentação menciona "2 Bytes" mas o valor está no range 0x0-0x64,
 * o que sugere que o primeiro byte contém o valor (0-100) e o segundo pode ser padding.
 * 
 * Exemplo:
 *  - [0x00, 0x00] = 0%
 *  - [0x32, 0x00] = 50%
 *  - [0x64, 0x00] = 100%
 */
export function parseBatteryStatusFromBase64(
  value: string | null | undefined,
): BatteryStatus | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 1) return null;

  const byte1 = bytes[0]!;
  const byte2 = bytes.length >= 2 ? bytes[1]! : 0;

  // A documentação indica que o valor está no range 0x0 a 0x64 (0-100)
  // Isso sugere que o primeiro byte contém a porcentagem diretamente
  // Se o primeiro byte estiver no range válido (0-100), usamos ele
  // Caso contrário, tentamos interpretar como little-endian (2 bytes)
  
  let percentage: number;
  let hexValue: string;
  
  if (byte1 <= 100) {
    // Primeiro byte está no range válido, provavelmente é o valor direto
    percentage = byte1;
    hexValue = `0x${byte1.toString(16).padStart(2, '0')}`;
  } else {
    // Primeiro byte > 100, pode ser que o valor esteja em 2 bytes (little-endian)
    const valueLE = byte1 + (byte2 << 8);
    percentage = valueLE;
    hexValue = `0x${byte1.toString(16).padStart(2, '0')}${byte2.toString(16).padStart(2, '0')}`;
  }
  
  // Garante que está no range 0-100
  percentage = Math.max(0, Math.min(100, percentage));

  return {
    rawBytes: bytes.length >= 2 ? [byte1, byte2] : [byte1],
    percentage,
    hexValue,
  };
}

