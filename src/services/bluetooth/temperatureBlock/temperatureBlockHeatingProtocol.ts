import { base64ToBytes } from '../core/utils';

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
 * 
 * IMPORTANTE: Observações do comportamento do hardware:
 *  - O hardware pode estar resetando esse valor para 0x0000 quando a análise começa
 *  - O valor pode estar disponível apenas em um momento específico (logo após atingir a temperatura, antes de iniciar a análise)
 *  - Em testes, o hardware tem enviado consistentemente 0x0000 mesmo após aquecimento completo
 *  - Isso pode ser comportamento esperado do hardware (resetar após iniciar análise) ou um bug no firmware
 * 
 * Nota: Se ambos os bytes forem 0, pode indicar que:
 *  - O hardware ainda não iniciou o aquecimento
 *  - O tempo ainda não foi calculado
 *  - O hardware está em estado inicial/standby
 *  - O hardware resetou o valor após iniciar a análise (comportamento observado)
 */
export function parseHeatingTimeFromBase64(
  value: string | null | undefined,
): TemperatureBlockHeatingTimeStatus | null {
  if (!value) return null;
  
  const bytes = base64ToBytes(value);
  
  if (bytes.length < 2) {
    return null;
  }

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

