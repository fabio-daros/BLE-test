import { decode as atob, encode as btoa } from 'base-64';

// UUIDs do hardware conforme documentação
export const PRE_TEST_SERVICE_UUID =
  '4fafc201-1fb5-459e-8fcc-c5c9c331914b';

// Características do pré-teste
export const PRETESTE_UUID = '7c01e789-e2c2-4194-bf38-e276e8f5cf8a'; // READ - Status atual do preteste
export const PRETESTE_RESULTADO_UUID = '18caa5e0-ac2d-4819-83af-cf8b4d530d20'; // NOTIFY, READ - Resultado do preteste
export const ERRO_ANALISE_UUID = 'cac8858d-2b4a-4fdd-a89b-6cfd28b4743f'; // NOTIFY, READ - Falha na análise
export const SUCESSO_ANALISE_UUID = '8a017ac9-e48c-4849-9923-7d1db7f399b1'; // NOTIFY - Análise concluída

// Outras características (para referência futura)
export const CONFIGURA_BLOCO_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // WRITE - Configurar temperatura e tipo de teste
export const STATUS_BATERIA_UUID = '906d7ba4-d34c-4f2c-8633-c08239c4a432'; // READ - Porcentagem da bateria
export const TEMPERATURA_BLOCO_UUID = 'df60fccb-9b33-4492-a633-e68e7df3c58d'; // READ - Temperatura atual do bloco
export const TEMPO_AQUECIMENTO_BLOCO_UUID = 'b3da2006-d898-43e4-933c-fb6e389ffd09'; // READ - Tempo de aquecimento
export const STATUS_DISPOSITIVO_UUID = '4c6098a9-0f22-494c-9b10-bc136656bc18'; // READ - Tempo decorrido desde início
export const QUANTIDADE_TESTE_MEMORIA_UUID = '563a426f-c423-4b89-8d2b-269c8a45b826'; // READ - Quantos testes em memória
export const RECUPERA_TESTE_MEMORIA_UUID = 'f0730b28-328c-4b89-b058-95a8817137eb'; // READ - Retorna teste da memória

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
