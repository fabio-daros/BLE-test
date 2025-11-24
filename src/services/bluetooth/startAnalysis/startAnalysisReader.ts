import type { Device } from 'react-native-ble-plx';
import {
  START_ANALYSIS_SERVICE_UUID,
  INICIO_ANALISE_UUID,
} from './startAnalysisProtocol';
import { monitorCharacteristic } from '../core';

export interface StartAnalysisSubscriptions {
  stop: () => void;
}

/**
 * Monitora a notificação de início de análise (NOTIFY)
 * Conforme documentação: não vem dado, é só callback mesmo
 */
export async function attachStartAnalysisMonitors(
  device: Device,
  onMessage: (msg: string) => void,
  onAnalysisStarted?: () => void,
): Promise<StartAnalysisSubscriptions> {
  try {
    onMessage('🚀 attachStartAnalysisMonitors chamado!');
    onMessage(`🔍 Service UUID: ${START_ANALYSIS_SERVICE_UUID}`);
    onMessage(`🔔 Characteristic UUID (NOTIFY): ${INICIO_ANALISE_UUID}`);
    onMessage('=== Iniciando monitoramento de início de análise ===');

    const stopMonitor = await monitorCharacteristic(device, {
      serviceUuid: START_ANALYSIS_SERVICE_UUID,
      characteristicUuid: INICIO_ANALISE_UUID,
      onData: (value) => {
        // Conforme documentação: não vem dado, é só callback
        // O value pode ser null ou vazio, mas o importante é que o callback foi disparado
        onMessage('📢 Notificação de início de análise recebida (callback)');
        if (onAnalysisStarted) {
          onAnalysisStarted();
        }
      },
      onMessage,
      silentOnConnectionError: true,
    });

    onMessage('✅ Monitoramento de início de análise anexado');

    return {
      stop: () => {
        onMessage('🛑 Parando monitoramento de início de análise...');
        try {
          stopMonitor();
        } catch (e) {
          // ignore
        }
        onMessage('✅ Monitoramento de início de análise finalizado');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitoramento de início de análise: ${error?.message || String(error)}`,
    );

    return {
      stop: () => {
        onMessage('Monitoramento já foi limpo devido a erro');
      },
    };
  }
}

export function detachStartAnalysisMonitors(
  subs: StartAnalysisSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitoramento de início de análise: ${e?.message || String(e)}`);
  }
}



