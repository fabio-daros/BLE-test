import { base64ToBytes } from '../core/utils';

/**
 * UUID conforme documentação:
 * STATUS_DISPOSITIVO_UUID: "4c6098a9-0f22-494c-9b10-bc136656bc18" 
 * // READ (Indo o tempo decorrido desde o inicio da analise)
 * 
 * IMPORTANTE: Observação do comportamento real do hardware:
 * - O hardware está retornando apenas 1 byte (status do equipamento) em vez de 2 bytes (tempo decorrido)
 * - Isso pode ser um bug no firmware ou comportamento diferente do esperado
 * - Quando receber 2 bytes, tentamos ler como tempo decorrido
 * - Quando receber 1 byte, retornamos null (é status, não tempo)
 */
export const ANALYSIS_ELAPSED_TIME_UUID =
  '4c6098a9-0f22-494c-9b10-bc136656bc18'; // READ - Tempo decorrido desde o início da análise (conforme doc)

export interface AnalysisElapsedTimeStatus {
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
 *  - Indica o tempo decorrido desde o início da análise
 * 
 * IMPORTANTE: O mesmo UUID também retorna o status do equipamento (1 byte).
 * Quando o hardware está em standby, pode retornar apenas 1 byte (status).
 * Quando está em análise, pode retornar 2 bytes (tempo decorrido) ou 3 bytes (status + tempo).
 * 
 * Este parser tenta ler como tempo decorrido:
 * - Se receber 1 byte: retorna null (é status, não tempo)
 * - Se receber 2 bytes: lê como horas e minutos
 * - Se receber 3+ bytes: lê bytes [1] e [2] como horas e minutos (byte [0] é status)
 */
export function parseAnalysisElapsedTimeFromBase64(
  value: string | null | undefined,
): AnalysisElapsedTimeStatus | null {
  if (!value) return null;
  
  const bytes = base64ToBytes(value);
  
  // Se receber apenas 1 byte, é status do equipamento, não tempo decorrido
  if (bytes.length < 2) {
    return null;
  }

  // Se receber 3+ bytes, o primeiro byte é status, os próximos 2 são tempo
  // Se receber 2 bytes, ambos são tempo
  const hours = bytes.length >= 3 ? (bytes[1] ?? 0) : (bytes[0] ?? 0);
  const minutes = bytes.length >= 3 ? (bytes[2] ?? 0) : (bytes[1] ?? 0);
  const totalMinutes = hours * 60 + minutes;
  const hexValue = `0x${hours.toString(16).padStart(2, '0')}${minutes
    .toString(16)
    .padStart(2, '0')}`;

  return {
    rawBytes: bytes.length >= 3 ? [bytes[1]!, bytes[2]!] : [bytes[0]!, bytes[1]!],
    hours,
    minutes,
    totalMinutes,
    hexValue,
  };
}

