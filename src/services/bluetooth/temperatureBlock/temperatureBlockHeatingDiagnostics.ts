import { base64ToBytes } from '../core/utils';
import type { TemperatureBlockHeatingTimeStatus } from './temperatureBlockHeatingProtocol';

/**
 * Diagnósticos para o tempo de aquecimento do bloco
 */

export interface HeatingTimeDiagnostics {
  rawBase64: string;
  decodedBytes: number[];
  bytesHex: string;
  parsedStatus: TemperatureBlockHeatingTimeStatus | null;
  analysis: {
    isValid: boolean;
    isZero: boolean;
    possibleReasons: string[];
    recommendations: string[];
  };
}

/**
 * Analisa o valor recebido do tempo de aquecimento e fornece diagnósticos
 */
export function diagnoseHeatingTime(
  base64Value: string | null | undefined,
  parsedStatus: TemperatureBlockHeatingTimeStatus | null,
): HeatingTimeDiagnostics | null {
  if (!base64Value) return null;

  const bytes = base64ToBytes(base64Value);
  const bytesHex = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');

  const isZero = parsedStatus?.totalMinutes === 0;
  const isValid = parsedStatus !== null && bytes.length >= 2;

  const possibleReasons: string[] = [];
  const recommendations: string[] = [];

  if (isZero) {
    possibleReasons.push(
      'Hardware ainda não iniciou o processo de aquecimento',
      'Configuração de temperatura ainda não foi aplicada/enviada',
      'Hardware está em estado inicial/standby',
      'Tempo de aquecimento ainda não foi calculado pelo hardware',
    );
    recommendations.push(
      'Verifique se a configuração de temperatura foi enviada corretamente',
      'Aguarde alguns segundos e verifique novamente',
      'Confirme que o hardware está em modo de análise/aquecimento',
      'Verifique o status do equipamento para confirmar o estado atual',
    );
  }

  if (!isValid) {
    possibleReasons.push(
      'Dados recebidos estão incompletos (menos de 2 bytes)',
      'Erro na decodificação Base64',
      'Hardware pode estar enviando dados em formato diferente',
    );
    recommendations.push(
      'Verifique se o hardware está conectado corretamente',
      'Confirme o protocolo de comunicação com o desenvolvedor do hardware',
      'Verifique os logs detalhados para mais informações',
    );
  }

  if (bytes.length === 2 && bytes[0] === 0 && bytes[1] === 0) {
    possibleReasons.push('Hardware enviou explicitamente [0, 0] - valor zero');
  }

  return {
    rawBase64: base64Value,
    decodedBytes: bytes,
    bytesHex,
    parsedStatus,
    analysis: {
      isValid,
      isZero,
      possibleReasons,
      recommendations,
    },
  };
}

/**
 * Formata os diagnósticos em uma string legível
 */
export function formatHeatingTimeDiagnostics(
  diagnostics: HeatingTimeDiagnostics,
): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('🔍 DIAGNÓSTICO: Tempo de Aquecimento do Bloco');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');
  lines.push('📥 DADOS RECEBIDOS:');
  lines.push(`   Base64: ${diagnostics.rawBase64}`);
  lines.push(`   Bytes: [${diagnostics.decodedBytes.join(', ')}]`);
  lines.push(`   Hex: ${diagnostics.bytesHex}`);
  lines.push(`   Tamanho: ${diagnostics.decodedBytes.length} bytes`);
  lines.push('');

  if (diagnostics.parsedStatus) {
    lines.push('📊 RESULTADO DO PARSE:');
    lines.push(
      `   Tempo: ${diagnostics.parsedStatus.hours}h${diagnostics.parsedStatus.minutes
        .toString()
        .padStart(2, '0')} (${diagnostics.parsedStatus.totalMinutes} minutos)`,
    );
    lines.push(`   Hex: ${diagnostics.parsedStatus.hexValue}`);
    lines.push('');
  } else {
    lines.push('❌ PARSE FALHOU');
    lines.push('');
  }

  lines.push('🔍 ANÁLISE:');
  lines.push(`   Válido: ${diagnostics.analysis.isValid ? '✅ Sim' : '❌ Não'}`);
  lines.push(`   É zero: ${diagnostics.analysis.isZero ? '⚠️ Sim' : '✅ Não'}`);
  lines.push('');

  if (diagnostics.analysis.possibleReasons.length > 0) {
    lines.push('💡 POSSÍVEIS RAZÕES:');
    diagnostics.analysis.possibleReasons.forEach((reason, idx) => {
      lines.push(`   ${idx + 1}. ${reason}`);
    });
    lines.push('');
  }

  if (diagnostics.analysis.recommendations.length > 0) {
    lines.push('💡 RECOMENDAÇÕES:');
    diagnostics.analysis.recommendations.forEach((rec, idx) => {
      lines.push(`   ${idx + 1}. ${rec}`);
    });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

