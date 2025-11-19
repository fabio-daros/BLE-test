import { decode as atob, encode as btoa } from 'base-64';

// TODO: Substituir pelas UUIDs reais do hardware
export const PRE_TEST_SERVICE_UUID =
  '0000aaaa-0000-1000-8000-00805f9b34fb';

export const PRE_TEST_STATUS_CHAR_UUID =
  '0000aa01-0000-1000-8000-00805f9b34fb';

export const PRE_TEST_FAILURE_CHAR_UUID =
  '0000aa02-0000-1000-8000-00805f9b34fb';

// (Opcional) characteristic para enviar comandos de "get statamsus" / "get result"
export const PRE_TEST_COMMAND_CHAR_UUID =
  '0000aa03-0000-1000-8000-00805f9b34fb';

// --------- Tipos de alto nível ---------

export type PreTestPhase = 'not_started' | 'in_progress' | 'completed' | 'unknown';

export interface PreTestStatus {
  rawByte: number;
  phase: PreTestPhase;
  isInProgress: boolean;
  isCompleted: boolean;
  isNotStarted: boolean;
}

export interface PreTestFailureFlags {
  rawByte1: number;
  rawByte2: number;
  lowBattery: boolean;      // bit 1
  heatingFailure: boolean;  // bit 2
  lidOpen: boolean;         // bit 3
  wellError: boolean;       // bit 4
  failedWellsMask: number;  // byte2 em hexa (poços com falha)
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

export function bytesToBase64(bytes: ArrayLike<number>): string {
  const len = bytes.length;
  let binary = '';

  for (let i = 0; i < len; i += 1) {
    const v = bytes[i] as number; // non-null assertion
    binary += String.fromCharCode(v);
  }

  return btoa(binary);
}

// --------- Parsing do STATUS do pré-teste ---------

/**
 * Protocolo (conforme seu post-it roxo):
 *  - byte único com bits:
 *    bit 1 = em processo de teste
 *    bit 2 = concluído
 *    bit 3 = não iniciado
 */
export function parsePreTestStatusFromBase64(
  value: string | null | undefined,
): PreTestStatus | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 1) return null;

  const byte = bytes[0]!; // já garantimos length >= 1

  const inProgress = (byte & 0b00000001) !== 0;
  const completed = (byte & 0b00000010) !== 0;
  const notStarted = (byte & 0b00000100) !== 0;

  let phase: PreTestPhase = 'unknown';
  if (inProgress && !completed && !notStarted) phase = 'in_progress';
  else if (!inProgress && completed && !notStarted) phase = 'completed';
  else if (!inProgress && !completed && notStarted) phase = 'not_started';

  return {
    rawByte: byte,
    phase,
    isInProgress: inProgress,
    isCompleted: completed,
    isNotStarted: notStarted,
  };
}

// --------- Parsing das FALHAS (ByteArray de 2 bytes) ---------

/**
 * Protocolo (post-it verde):
 *
 * Byte Array Falha (2 bytes)
 *  Byte 1 (bits):
 *    bit 1 = bateria baixa
 *    bit 2 = falha aquecimento
 *    bit 3 = tampa aberta
 *    bit 4 = poço com falha
 *  Byte 2:
 *    mapa de poços com falha (hex)
 */
export function parsePreTestFailureFromBase64(
  value: string | null | undefined,
): PreTestFailureFlags | null {
  const bytes = base64ToBytes(value);
  if (bytes.length < 2) return null;

  const byte1 = bytes[0]!; // non-null, pois length >= 2
  const byte2 = bytes[1]!;

  const lowBattery = (byte1 & 0b00000001) !== 0;
  const heatingFailure = (byte1 & 0b00000010) !== 0;
  const lidOpen = (byte1 & 0b00000100) !== 0;
  const wellError = (byte1 & 0b00001000) !== 0;

  return {
    rawByte1: byte1,
    rawByte2: byte2,
    lowBattery,
    heatingFailure,
    lidOpen,
    wellError,
    failedWellsMask: byte2,
  };
}

// --------- (Opcional) comandos de request ---------
// Esses comandos são placeholders – ajusta conforme o protocolo real.

export function buildRequestPreTestStatusCommand(): Uint8Array {
  // Exemplo: comando 0x10 = "me mande o status do pré-teste"
  return new Uint8Array([0x10]);
}

export function buildRequestPreTestResultCommand(): Uint8Array {
  // Exemplo: comando 0x11 = "me mande o resultado do pré-teste"
  return new Uint8Array([0x11]);
}
