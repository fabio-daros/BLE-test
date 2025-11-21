import type { Device } from 'react-native-ble-plx';
import {
  PRE_TEST_SERVICE_UUID,
  PRETESTE_UUID,
  PRETESTE_RESULTADO_UUID,
  ERRO_ANALISE_UUID,
  SUCESSO_ANALISE_UUID,
  parsePreTestStatusFromBase64,
  parsePreTestFailureFromBase64,
} from './preTestProtocol';
import { readCharacteristic, monitorCharacteristic } from '../core';

export interface PreTestSubscriptions {
  stop: () => void;
}

/**
 * Lê o status atual do pré-teste (característica READ)
 */
async function readPreTestStatus(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<void> {
  const value = await readCharacteristic(device, {
    serviceUuid: PRE_TEST_SERVICE_UUID,
    characteristicUuid: PRETESTE_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return;
  }

  const status = parsePreTestStatusFromBase64(value);
  if (status) {
    onMessage(
      `✅ Status do Pré-teste: ${status.phase} | ` +
        `Em progresso: ${status.isInProgress} | ` +
        `Concluído: ${status.isCompleted} | ` +
        `Não iniciado: ${status.isNotStarted} | ` +
        `Byte: 0x${status.rawByte.toString(16).padStart(2, '0')}`,
    );
  } else {
    onMessage('⚠️ Não foi possível fazer parse do status');
  }
}

/**
 * Lê o resultado do pré-teste (característica READ)
 */
async function readPreTestResult(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<void> {
  const value = await readCharacteristic(device, {
    serviceUuid: PRE_TEST_SERVICE_UUID,
    characteristicUuid: PRETESTE_RESULTADO_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    return;
  }

  const status = parsePreTestStatusFromBase64(value);
  if (status) {
    onMessage(`✅ Resultado parseado: ${JSON.stringify(status)}`);
  } else {
    onMessage('⚠️ Formato do resultado não reconhecido');
  }
}

/**
 * Lê erros de análise (característica READ)
 */
async function readAnalysisError(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<void> {
  const value = await readCharacteristic(device, {
    serviceUuid: PRE_TEST_SERVICE_UUID,
    characteristicUuid: ERRO_ANALISE_UUID,
    onMessage,
    silentOnConnectionError: true,
  });

  if (!value) {
    onMessage('✅ Nenhum erro detectado (característica vazia)');
    return;
  }

  const failure = parsePreTestFailureFromBase64(value);
  if (failure) {
    onMessage(
      `⚠️ Falhas detectadas: ` +
        `Bateria baixa: ${failure.lowBattery} | ` +
        `Falha aquecimento: ${failure.heatingFailure} | ` +
        `Tampa aberta: ${failure.lidOpen} | ` +
        `Erro poço: ${failure.wellError} | ` +
        `Máscara poços: 0x${failure.failedWellsMask.toString(16).padStart(2, '0')}`,
    );
  } else {
    onMessage('✅ Nenhuma falha detectada (ou formato não reconhecido)');
  }
}

/**
 * Anexa monitores e leituras para o pré-teste
 */
export async function attachPreTestMonitors(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<PreTestSubscriptions> {
  const stopFunctions: Array<() => void> = [];

  try {
    onMessage('🚀 attachPreTestMonitors chamado!');
    onMessage(`🔍 Service UUID: ${PRE_TEST_SERVICE_UUID}`);
    onMessage('=== Iniciando monitoramento do pré-teste ===');

    // 1. Leitura inicial do status (READ)
    await readPreTestStatus(device, onMessage);

    // 2. Leitura inicial do resultado (READ)
    await readPreTestResult(device, onMessage);

    // 3. Leitura inicial de erros (READ)
    await readAnalysisError(device, onMessage);

    // 4. Monitora resultado do pré-teste (NOTIFY)
    try {
      const stopResultado = await monitorCharacteristic(device, {
        serviceUuid: PRE_TEST_SERVICE_UUID,
        characteristicUuid: PRETESTE_RESULTADO_UUID,
        onData: (value) => {
          if (value) {
            const status = parsePreTestStatusFromBase64(value);
            if (status) {
              onMessage(
                `🔔 Resultado recebido: ${status.phase} | Byte: 0x${status.rawByte.toString(16).padStart(2, '0')}`,
              );
            }
          }
        },
        onMessage,
        silentOnConnectionError: true,
      });
      stopFunctions.push(stopResultado);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar Resultado do Pré-teste: ${error?.message || String(error)}`,
      );
    }

    // 5. Monitora erros de análise (NOTIFY)
    try {
      const stopErro = await monitorCharacteristic(device, {
        serviceUuid: PRE_TEST_SERVICE_UUID,
        characteristicUuid: ERRO_ANALISE_UUID,
        onData: (value) => {
          if (value) {
            const failure = parsePreTestFailureFromBase64(value);
            if (failure) {
              onMessage(
                `🔔 ⚠️ ERRO recebido: ` +
                  `Bateria: ${failure.lowBattery} | ` +
                  `Aquecimento: ${failure.heatingFailure} | ` +
                  `Tampa: ${failure.lidOpen} | ` +
                  `Poço: ${failure.wellError}`,
              );
            }
          }
        },
        onMessage,
        silentOnConnectionError: true,
      });
      stopFunctions.push(stopErro);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar Erro de Análise: ${error?.message || String(error)}`,
      );
    }

    // 6. Monitora sucesso de análise (NOTIFY)
    try {
      const stopSucesso = await monitorCharacteristic(device, {
        serviceUuid: PRE_TEST_SERVICE_UUID,
        characteristicUuid: SUCESSO_ANALISE_UUID,
        onData: (value) => {
          onMessage(`🔔 ✅ SUCESSO: Análise concluída! (base64: ${value || 'null'})`);
        },
        onMessage,
        silentOnConnectionError: true,
      });
      stopFunctions.push(stopSucesso);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar Sucesso de Análise: ${error?.message || String(error)}`,
      );
    }

    onMessage('✅ Todos os monitores de pré-teste foram anexados');

    return {
      stop: () => {
        onMessage('🛑 Parando monitores de pré-teste...');
        stopFunctions.forEach(stop => {
          try {
            stop();
          } catch (e) {
            // ignore
          }
        });
        onMessage('✅ Monitores de pré-teste finalizados');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitores: ${error?.message || String(error)}`,
    );

    // Limpa tudo em caso de erro
    stopFunctions.forEach(stop => {
      try {
        stop();
      } catch (e) {
        // ignore
      }
    });

    return {
      stop: () => {
        onMessage('Monitores já foram limpos devido a erro');
      },
    };
  }
}

export function detachPreTestMonitors(
  subs: PreTestSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitores: ${e?.message || String(e)}`);
  }
}
