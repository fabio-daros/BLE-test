import { base64ToBytes } from './temperatureBlockProtocol';

export const TEMPO_AQUECIMENTO_BLOCO_UUID =
  'b3da2006-d898-43e4-933c-fb6e389ffd09'; // READ - Tempo até atingir temperatura

export interface TemperatureBlockHeatingTimeStatus {
  rawBytes: number[]; // 2 bytes (hora, minuto)
  hours: number;
  minutes: number;
  totalMinutes: number;
  hexValue: string;
}

/**
 * Protocolo (conforme documentação):
 *  - 2 Bytes (hhmm, ambos em hexadecimal)
 *  - Byte 1 = horas (0-255)
 *  - Byte 2 = minutos (0-59)
 */
export function parseHeatingTimeFromBase64(
  value: string | null | undefined,
): TemperatureBlockHeatingTimeStatus | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 2) return null;

  const hours = bytes[0] ?? 0;
  const minutes = bytes[1] ?? 0;
  const totalMinutes = hours * 60 + minutes;
  const hexValue = `0x${hours.toString(16).padStart(2, '0')}${minutes
    .toString(16)
    .padStart(2, '0')}`;

  return {
    rawBytes: [hours, minutes],
    hours,
    minutes,
    totalMinutes,
    hexValue,
  };
}

