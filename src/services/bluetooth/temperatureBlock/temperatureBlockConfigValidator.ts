import {
  buildTemperatureBlockConfigPayload,
  type TemperatureBlockConfigInput,
} from './temperatureBlockConfigProtocol';

/**
 * Valida e exibe detalhes da configuração que será enviada ao hardware.
 * Útil para debug e verificação do protocolo.
 */
export function validateTemperatureBlockConfig(
  input: TemperatureBlockConfigInput,
): {
  valid: boolean;
  details: {
    input: TemperatureBlockConfigInput;
    payload: ReturnType<typeof buildTemperatureBlockConfigPayload>;
    byte1Breakdown: {
      binary: string;
      typeBit: number;
      typeValue: 'colorimetric' | 'fluorimetric';
      temperatureBits: string;
      temperatureValue: number;
    };
    byte2Breakdown: {
      binary: string;
      reactionTimeMinutes: number;
    };
    exampleMatch: {
      matches: boolean;
      expectedHex?: string;
      actualHex: string;
    };
  };
} {
  const payload = buildTemperatureBlockConfigPayload(input);
  const byte1 = payload.bytes[0];
  const byte2 = payload.bytes[1];

  // Breakdown do Byte 1
  const typeBit = (byte1 >> 7) & 1;
  const temperatureValue = byte1 & 0b01111111;
  const byte1Binary = byte1.toString(2).padStart(8, '0');
  const temperatureBits = (byte1 & 0b01111111).toString(2).padStart(7, '0');

  // Breakdown do Byte 2
  const byte2Binary = byte2.toString(2).padStart(8, '0');

  // Validação
  const valid =
    temperatureValue >= 0 &&
    temperatureValue <= 127 &&
    byte2 >= 0 &&
    byte2 <= 255 &&
    (typeBit === 0 || typeBit === 1);

  // Exemplo de validação: 37°C fluorimétrica, 15 minutos = 0xA50F
  let exampleMatch = { matches: false, actualHex: payload.hex };
  if (
    input.temperatureCelsius === 37 &&
    input.testType === 'fluorimetric' &&
    input.reactionTimeMinutes === 15
  ) {
    const expectedHex = '0xA50F';
    exampleMatch = {
      matches: payload.hex.toUpperCase() === expectedHex,
      expectedHex,
      actualHex: payload.hex,
    };
  }

  return {
    valid,
    details: {
      input,
      payload,
      byte1Breakdown: {
        binary: byte1Binary,
        typeBit,
        typeValue: typeBit === 1 ? 'fluorimetric' : 'colorimetric',
        temperatureBits,
        temperatureValue,
      },
      byte2Breakdown: {
        binary: byte2Binary,
        reactionTimeMinutes: byte2,
      },
      exampleMatch,
    },
  };
}

/**
 * Formata a validação em uma string legível para logs
 */
export function formatConfigValidation(
  validation: ReturnType<typeof validateTemperatureBlockConfig>,
): string {
  const { details } = validation;
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('📋 VALIDAÇÃO DA CONFIGURAÇÃO DO BLOCO DE TEMPERATURA');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push('📥 ENTRADA:');
  lines.push(`   Temperatura: ${details.input.temperatureCelsius}°C`);
  lines.push(`   Tipo de teste: ${details.input.testType}`);
  lines.push(`   Tempo de reação: ${details.input.reactionTimeMinutes} minutos`);
  lines.push('');
  lines.push('📤 PAYLOAD GERADO:');
  lines.push(`   Hex: ${details.payload.hex}`);
  lines.push(`   Bytes: [0x${details.payload.bytes[0]!.toString(16).padStart(2, '0').toUpperCase()}, 0x${details.payload.bytes[1]!.toString(16).padStart(2, '0').toUpperCase()}]`);
  lines.push(`   Base64: ${details.payload.base64}`);
  lines.push('');
  lines.push('🔍 BREAKDOWN DO BYTE 1 (Tipo + Temperatura):');
  lines.push(`   Binário completo: ${details.byte1Breakdown.binary}`);
  lines.push(`   Bit 8 (tipo): ${details.byte1Breakdown.typeBit} = ${details.byte1Breakdown.typeValue}`);
  lines.push(`   Bits 0-7 (temperatura): ${details.byte1Breakdown.temperatureBits} = ${details.byte1Breakdown.temperatureValue}°C`);
  lines.push('');
  lines.push('🔍 BREAKDOWN DO BYTE 2 (Tempo de Reação):');
  lines.push(`   Binário: ${details.byte2Breakdown.binary}`);
  lines.push(`   Valor: ${details.byte2Breakdown.reactionTimeMinutes} minutos`);
  lines.push('');

  if (details.exampleMatch.expectedHex) {
    if (details.exampleMatch.matches) {
      lines.push('✅ EXEMPLO DA DOCUMENTAÇÃO:');
      lines.push(`   Esperado: ${details.exampleMatch.expectedHex}`);
      lines.push(`   Obtido: ${details.exampleMatch.actualHex}`);
      lines.push('   ✓ CORRETO!');
    } else {
      lines.push('⚠️ EXEMPLO DA DOCUMENTAÇÃO:');
      lines.push(`   Esperado: ${details.exampleMatch.expectedHex}`);
      lines.push(`   Obtido: ${details.exampleMatch.actualHex}`);
      lines.push('   ✗ NÃO CORRESPONDE!');
    }
    lines.push('');
  }

  lines.push(`Status: ${validation.valid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

