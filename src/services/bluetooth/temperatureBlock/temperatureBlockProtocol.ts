import { decode as atob } from 'base-64';

// UUIDs do hardware conforme documentação
export const TEMPERATURE_BLOCK_SERVICE_UUID =
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b'; // Mesmo serviço do pré-teste

// Característica da temperatura do bloco
export const TEMPERATURA_BLOCO_UUID = 'df60fccb-9b33-4492-a633-e68e7df3c58d'; // READ - Indica a temperatura atual do bloco

// --------- Tipos de alto nível ---------

export interface TemperatureBlockStatus {
  rawBytes: number[]; // 2 bytes
  temperature: number; // Temperatura em graus Celsius (pode ser negativa)
  isPositive: boolean; // true = positivo, false = negativo
  hexValue: string; // Valor em hexadecimal
}

// --------- Helpers base64 <-> bytes ---------

export function base64ToBytes(value: string | null | undefined): number[] {
  if (!value) return [];
  const binary = atob(value); // string binária
  const len = binary.length;
  const bytes = new Array<number>(len);

  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}


// --------- Parsing da TEMPERATURA do bloco ---------

/**
 * Protocolo (conforme documentação):
 *  - 2 Bytes
 *  - bit 1 (bit 0 do primeiro byte) = 1 positivo ou 0 negativo
 *  - bits 2-8 (bits 1-7 do primeiro byte) = temperatura (0-127)
 *  - Vai em hexadecimal
 * 
 * Formato:
 *  Byte 1: [S][T6][T5][T4][T3][T2][T1][T0]
 *          S = bit de sinal (0=negativo, 1=positivo)
 *          T0-T6 = bits da temperatura (0-127)
 *  Byte 2: (provavelmente não usado ou parte do valor)
 * 
 * Exemplo:
 *  - [0b01111111, 0x00] = +127°C (bit 0=1 positivo, bits 1-7=127)
 *  - [0b00000000, 0x00] = 0°C (bit 0=0 negativo, mas temperatura=0)
 *  - [0b00000001, 0x00] = +1°C (bit 0=1 positivo, bits 1-7=1)
 *  - [0b00000000, 0x01] = -1°C? (precisa confirmar com dados reais)
 */
export function parseTemperatureBlockFromBase64(
  value: string | null | undefined,
): TemperatureBlockStatus | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 1) return null;

  const byte1 = bytes[0]!;
  const byte2 = bytes.length >= 2 ? bytes[1]! : 0;

  // Extrai o bit de sinal (bit 0 do primeiro byte)
  const signBit = byte1 & 0b00000001;
  const isPositive = signBit === 1;

  // Extrai os bits da temperatura (bits 1-7 do primeiro byte)
  // Remove o bit de sinal: shift right 1 bit e pega os 7 bits restantes
  const temperatureValue = (byte1 >> 1) & 0b01111111; // Máximo 127

  // Se o segundo byte for usado, pode ser parte do valor
  // Por enquanto, vamos usar apenas o primeiro byte conforme a documentação
  // Se byte2 for diferente de 0, pode ser que o valor esteja em 2 bytes
  let temperature: number;
  
  if (byte2 === 0) {
    // Apenas o primeiro byte contém o valor
    temperature = isPositive ? temperatureValue : -temperatureValue;
  } else {
    // Dois bytes - pode ser little-endian ou big-endian
    // Vamos tentar little-endian primeiro
    const combinedValue = byte1 + (byte2 << 8);
    const signBit2 = combinedValue & 0b00000001;
    const tempValue2 = (combinedValue >> 1) & 0b01111111;
    temperature = signBit2 === 1 ? tempValue2 : -tempValue2;
  }

  const hexValue = bytes.length >= 2
    ? `0x${byte1.toString(16).padStart(2, '0')}${byte2.toString(16).padStart(2, '0')}`
    : `0x${byte1.toString(16).padStart(2, '0')}`;

  return {
    rawBytes: bytes.length >= 2 ? [byte1, byte2] : [byte1],
    temperature,
    isPositive,
    hexValue,
  };
}

