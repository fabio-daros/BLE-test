export type EquipmentStatus = 'analysis' | 'standby';
export type PreTestStatus = 'not_started' | 'in_progress' | 'completed';

export interface TimeHm {
  hours: number;
  minutes: number;
}

export interface PreTestFailures {
  batteryLow: boolean;
  heatingFailure: boolean;
  lidOpen: boolean;
  wellFailure: boolean;
  failedWells: number;
}

export interface HardwareStatusJSON {
  batteryPercent: number; // 0–100
  blockTemperatureC: number; // -127..+127 (inteiro)
  blockHeatingTime: TimeHm; // hh:mm
  equipmentStatus: EquipmentStatus;
  analysisElapsed: TimeHm; // hh:mm desde início
  preTestStatus: PreTestStatus;
  preTestFailures?: PreTestFailures;
  testType?: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'none';
  testResult?: string;
}

const FRAME_LENGTH_BYTES = 13; // 2 + 2 + 2 + 1 + 2 + 1 + 2 + 1 + 1

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function writeUint16BigEndian(
  value: number,
  target: Uint8Array,
  offset: number
): void {
  const v = Math.max(0, Math.min(0xffff, value | 0));
  target[offset] = (v >> 8) & 0xff;
  target[offset + 1] = v & 0xff;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function encodeTemperatureByte(tempC: number): number {
  const isPositive = tempC >= 0 ? 1 : 0;
  const magnitude = Math.abs(Math.round(tempC));
  if (magnitude > 127) {
    throw new Error('Temperatura fora do intervalo codificável (-127..127).');
  }
  return ((isPositive & 0x01) << 7) | (magnitude & 0x7f);
}

function decodeTemperatureByte(byte: number): number {
  const isPositive = (byte & 0x80) !== 0 ? 1 : 0;
  const magnitude = byte & 0x7f;
  return isPositive === 1 ? magnitude : -magnitude;
}

function byteToBool(byte: number, bitIndex: number): boolean {
  return ((byte >> bitIndex) & 0x01) === 1;
}

function toEquipmentStatus(byte: number): EquipmentStatus {
  return byteToBool(byte, 0) ? 'analysis' : 'standby';
}

function fromEquipmentStatus(status: EquipmentStatus): number {
  return status === 'analysis' ? 0x01 : 0x00;
}

function readHm(bytes: Uint8Array, offset: number): TimeHm {
  return { hours: bytes[offset] ?? 0, minutes: bytes[offset + 1] ?? 0 };
}

function writeHm(value: TimeHm, target: Uint8Array, offset: number): void {
  const hours = clamp(value.hours | 0, 0, 255);
  const minutes = clamp(value.minutes | 0, 0, 255);
  target[offset] = hours;
  target[offset + 1] = minutes;
}

export function parseHardwareFrame(frame: Uint8Array): HardwareStatusJSON {
  if (!(frame instanceof Uint8Array)) {
    throw new Error('Frame inválido: esperado Uint8Array.');
  }
  if (frame.length !== FRAME_LENGTH_BYTES) {
    throw new Error(
      `Tamanho do frame inválido: esperado ${FRAME_LENGTH_BYTES}, recebido ${frame.length}.`
    );
  }

  const batteryPercentRaw = readUint16BigEndian(frame, 0);
  const batteryPercent = clamp(batteryPercentRaw, 0, 100);

  const tempByte = frame[2];
  const reservedByte = frame[3];
  // reservedByte pode ser diferente de 0x00 por compatibilidade futura – não falhamos aqui.
  const blockTemperatureC = decodeTemperatureByte(tempByte ?? 0);

  const blockHeatingTime = readHm(frame, 4);

  const equipmentStatus = toEquipmentStatus(frame[6] ?? 0);

  const analysisElapsed = readHm(frame, 7);

  // Parse pre-test status (byte 9)
  const preTestStatusByte = frame[9] ?? 0;
  let preTestStatus: 'not_started' | 'in_progress' | 'completed' =
    'not_started';
  if (preTestStatusByte & 0x02) preTestStatus = 'completed';
  else if (preTestStatusByte & 0x01) preTestStatus = 'in_progress';

  // Parse pre-test failures (bytes 10-11)
  const failureByte1 = frame[10] ?? 0;
  const failureByte2 = frame[11] ?? 0;
  const preTestFailures = {
    batteryLow: (failureByte1 & 0x01) !== 0,
    heatingFailure: (failureByte1 & 0x02) !== 0,
    lidOpen: (failureByte1 & 0x04) !== 0,
    wellFailure: (failureByte1 & 0x08) !== 0,
    failedWells: failureByte2,
  };

  // Parse test type (byte 12)
  const testTypeByte = frame[12] ?? 0;
  let testType: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'none' = 'none';
  switch (testTypeByte) {
    case 1:
      testType = 'cinomose';
      break;
    case 2:
      testType = 'ibv_geral';
      break;
    case 3:
      testType = 'ibv_especifico';
      break;
    default:
      testType = 'none';
  }

  return {
    batteryPercent,
    blockTemperatureC,
    blockHeatingTime,
    equipmentStatus,
    analysisElapsed,
    preTestStatus,
    preTestFailures,
    testType,
  };
}

export function serializeHardwareFrame(json: HardwareStatusJSON): Uint8Array {
  if (!json) throw new Error('JSON inválido.');

  const target = new Uint8Array(FRAME_LENGTH_BYTES);

  // Bateria
  writeUint16BigEndian(clamp(json.batteryPercent | 0, 0, 100), target, 0);

  // Temperatura (primeiro byte: sinal+magnitude; segundo byte reservado = 0x00)
  target[2] = encodeTemperatureByte(json.blockTemperatureC | 0);
  target[3] = 0x00;

  // Tempo de aquecimento do bloco
  writeHm(json.blockHeatingTime, target, 4);

  // Status do equipamento
  target[6] = fromEquipmentStatus(json.equipmentStatus);

  // Tempo decorrido desde início da análise
  writeHm(json.analysisElapsed, target, 7);

  // Byte reservado
  target[8] = 0x00;

  // Pre-test status (byte 9)
  let preTestStatusByte = 0x00;
  if (json.preTestStatus === 'in_progress') preTestStatusByte |= 0x01;
  else if (json.preTestStatus === 'completed') preTestStatusByte |= 0x02;
  target[9] = preTestStatusByte;

  // Pre-test failures (bytes 10-11)
  if (json.preTestFailures) {
    let failureByte1 = 0x00;
    if (json.preTestFailures.batteryLow) failureByte1 |= 0x01;
    if (json.preTestFailures.heatingFailure) failureByte1 |= 0x02;
    if (json.preTestFailures.lidOpen) failureByte1 |= 0x04;
    if (json.preTestFailures.wellFailure) failureByte1 |= 0x08;
    target[10] = failureByte1;
    target[11] = json.preTestFailures.failedWells & 0xff;
  } else {
    target[10] = 0x00;
    target[11] = 0x00;
  }

  // Test type (byte 12)
  let testTypeByte = 0x00;
  if (json.testType) {
    switch (json.testType) {
      case 'cinomose':
        testTypeByte = 1;
        break;
      case 'ibv_geral':
        testTypeByte = 2;
        break;
      case 'ibv_especifico':
        testTypeByte = 3;
        break;
      default:
        testTypeByte = 0;
    }
  }
  target[12] = testTypeByte;

  return target;
}
