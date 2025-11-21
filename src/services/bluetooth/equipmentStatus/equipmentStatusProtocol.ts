import { base64ToBytes } from '../core/utils';

// UUIDs do hardware conforme documentação
export const EQUIPMENT_STATUS_SERVICE_UUID =
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b'; // Mesmo serviço dos outros módulos

// Característica do status do equipamento
export const STATUS_DISPOSITIVO_UUID = '4c6098a9-0f22-494c-9b10-bc136656bc18'; // READ - Status do equipamento

// --------- Tipos de alto nível ---------

/**
 * Status do equipamento conforme protocolo:
 * - 0x00 = Standby
 * - 0x01 = Análise
 * - 0x02 = Erro análise
 * - 0x03 = Análise concluída
 */
export type EquipmentStatusType = 'standby' | 'analysis' | 'analysis_error' | 'analysis_completed';

export interface EquipmentStatus {
  rawByte: number;
  status: EquipmentStatusType;
  isStandby: boolean;
  isAnalysis: boolean;
  isAnalysisError: boolean;
  isAnalysisCompleted: boolean;
  hexValue: string;
}

/**
 * Converte o valor hexadecimal para o tipo de status
 */
function parseStatusType(byte: number): EquipmentStatusType {
  switch (byte) {
    case 0x00:
      return 'standby';
    case 0x01:
      return 'analysis';
    case 0x02:
      return 'analysis_error';
    case 0x03:
      return 'analysis_completed';
    default:
      // Se receber um valor desconhecido, assume standby por padrão
      return 'standby';
  }
}

/**
 * Parse do status do equipamento a partir de base64
 * Protocolo: 1 byte em hexadecimal
 */
export function parseEquipmentStatusFromBase64(
  value: string | null | undefined,
): EquipmentStatus | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 1) return null;

  const byte = bytes[0]!;
  const statusType = parseStatusType(byte);
  const hexValue = `0x${byte.toString(16).padStart(2, '0').toUpperCase()}`;

  return {
    rawByte: byte,
    status: statusType,
    isStandby: statusType === 'standby',
    isAnalysis: statusType === 'analysis',
    isAnalysisError: statusType === 'analysis_error',
    isAnalysisCompleted: statusType === 'analysis_completed',
    hexValue,
  };
}

/**
 * Obtém a descrição legível do status
 */
export function getEquipmentStatusDescription(status: EquipmentStatusType): string {
  switch (status) {
    case 'standby':
      return 'Standby';
    case 'analysis':
      return 'Análise';
    case 'analysis_error':
      return 'Erro análise';
    case 'analysis_completed':
      return 'Análise concluída';
    default:
      return 'Desconhecido';
  }
}

