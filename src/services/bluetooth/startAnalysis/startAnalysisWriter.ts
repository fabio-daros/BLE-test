import type { Device } from 'react-native-ble-plx';
import { START_ANALYSIS_SERVICE_UUID, BOTAO_INICIAR_UUID } from './startAnalysisProtocol';
import { writeCharacteristic } from '../core';

export interface StartAnalysisResult {
  success: boolean;
}

/**
 * Envia comando para iniciar ou parar a análise
 * Write vazio conforme documentação
 */
export async function writeStartAnalysis(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<StartAnalysisResult | null> {
  onMessage('✍️ Enviando comando para iniciar/parar análise');

  // Write vazio conforme documentação (payload vazio em base64)
  const emptyPayload = ''; // Array vazio convertido para base64

  const success = await writeCharacteristic(device, {
    serviceUuid: START_ANALYSIS_SERVICE_UUID,
    characteristicUuid: BOTAO_INICIAR_UUID,
    value: emptyPayload,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!success) {
    return null;
  }

  onMessage('✅ Comando de iniciar/parar análise enviado');

  return {
    success: true,
  };
}
