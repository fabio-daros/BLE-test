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
  try {
    // Verifica conexão antes de ler
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando leitura do pré-teste');
      return;
    }

    onMessage(`📖 Lendo status do pré-teste (UUID: ${PRETESTE_UUID})...`);
    const characteristic = await device.readCharacteristicForService(
      PRE_TEST_SERVICE_UUID,
      PRETESTE_UUID,
    );

    const value = characteristic.value;
    onMessage(`📊 Status RAW (base64): ${value || 'null'}`);

    if (value) {
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
    } else {
      onMessage('⚠️ Status vazio (característica não retornou dados)');
    }
  } catch (error: any) {
    // Trata erros de desconexão de forma silenciosa
    const errorMsg = error?.message || String(error) || '';
    const errorString = String(error).toLowerCase();
    
    if (errorMsg.includes('GATT_ERROR') || 
        errorMsg.includes('status 133') ||
        errorMsg.includes('0x85') ||
        errorMsg.includes('not connected') ||
        errorMsg.includes('disconnected') ||
        errorString.includes('gatt') ||
        errorString.includes('nullpointerexception')) {
      // Erro de conexão - não loga para não poluir
      return;
    }
    onMessage(
      `❌ Erro ao ler status do pré-teste: ${errorMsg}`,
    );
    // Não propaga o erro para não interromper o processo
  }
}

/**
 * Lê o resultado do pré-teste (característica READ)
 */
async function readPreTestResult(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<void> {
  try {
    // Verifica conexão antes de ler
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando leitura do resultado');
      return;
    }

    onMessage(`📖 Lendo resultado do pré-teste (UUID: ${PRETESTE_RESULTADO_UUID})...`);
    const characteristic = await device.readCharacteristicForService(
      PRE_TEST_SERVICE_UUID,
      PRETESTE_RESULTADO_UUID,
    );

    const value = characteristic.value;
    onMessage(`📊 Resultado RAW (base64): ${value || 'null'}`);

    if (value) {
      // O resultado pode ter formato diferente - vamos logar o raw primeiro
      const bytes = parsePreTestStatusFromBase64(value);
      if (bytes) {
        onMessage(`✅ Resultado parseado: ${JSON.stringify(bytes)}`);
      } else {
        onMessage('⚠️ Formato do resultado não reconhecido');
      }
    } else {
      onMessage('⚠️ Resultado vazio (característica não retornou dados)');
    }
  } catch (error: any) {
    // Trata erros de desconexão de forma silenciosa
    const errorMsg = error?.message || String(error) || '';
    const errorString = String(error).toLowerCase();
    
    if (errorMsg.includes('GATT_ERROR') || 
        errorMsg.includes('status 133') ||
        errorMsg.includes('0x85') ||
        errorMsg.includes('not connected') ||
        errorMsg.includes('disconnected') ||
        errorString.includes('gatt') ||
        errorString.includes('nullpointerexception')) {
      // Erro de conexão - não loga para não poluir
      return;
    }
    onMessage(
      `❌ Erro ao ler resultado do pré-teste: ${errorMsg}`,
    );
    // Não propaga o erro para não interromper o processo
  }
}

/**
 * Lê erros de análise (característica READ)
 */
async function readAnalysisError(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<void> {
  try {
    // Verifica conexão antes de ler
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando leitura de erros');
      return;
    }

    onMessage(`📖 Lendo erros de análise (UUID: ${ERRO_ANALISE_UUID})...`);
    const characteristic = await device.readCharacteristicForService(
      PRE_TEST_SERVICE_UUID,
      ERRO_ANALISE_UUID,
    );

    const value = characteristic.value;
    onMessage(`📊 Erro RAW (base64): ${value || 'null'}`);

    if (value) {
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
    } else {
      onMessage('✅ Nenhum erro detectado (característica vazia)');
    }
  } catch (error: any) {
    // Trata erros de desconexão de forma silenciosa
    const errorMsg = error?.message || String(error) || '';
    const errorString = String(error).toLowerCase();
    
    if (errorMsg.includes('GATT_ERROR') || 
        errorMsg.includes('status 133') ||
        errorMsg.includes('0x85') ||
        errorMsg.includes('not connected') ||
        errorMsg.includes('disconnected') ||
        errorString.includes('gatt') ||
        errorString.includes('nullpointerexception')) {
      // Erro de conexão - não loga para não poluir
      return;
    }
    onMessage(
      `❌ Erro ao ler falhas: ${errorMsg}`,
    );
    // Não propaga o erro para não interromper o processo
  }
}

/**
 * Verifica se uma característica existe e é notificável
 */
async function checkCharacteristicExists(
  device: Device,
  serviceUuid: string,
  characteristicUuid: string,
  name: string,
  onMessage: (msg: string) => void,
): Promise<boolean> {
  try {
    // Tenta descobrir serviços e características primeiro
    const services = await device.services();
    const service = services.find(s => s.uuid.toLowerCase() === serviceUuid.toLowerCase());
    
    if (!service) {
      onMessage(`⚠️ Serviço não encontrado para ${name}`);
      return false;
    }

    const characteristics = await service.characteristics();
    const characteristic = characteristics.find(
      c => c.uuid.toLowerCase() === characteristicUuid.toLowerCase()
    );

    if (!characteristic) {
      onMessage(`⚠️ Característica não encontrada para ${name}`);
      return false;
    }

    if (!characteristic.isNotifiable) {
      onMessage(`⚠️ ${name} não é notificável (apenas READ disponível)`);
      return false;
    }

    onMessage(`✅ ${name} encontrada e é notificável`);
    return true;
  } catch (error: any) {
    onMessage(
      `⚠️ Erro ao verificar ${name}: ${error?.message || String(error)}`,
    );
    return false;
  }
}

/**
 * Monitora notificações de uma característica de forma segura
 */
async function monitorCharacteristic(
  device: Device,
  serviceUuid: string,
  characteristicUuid: string,
  name: string,
  onMessage: (msg: string) => void,
  onData?: (value: string | null) => void,
): Promise<() => void> {
  let subscription: any = null;

  try {
    // Verifica se a característica existe e é notificável
    const canMonitor = await checkCharacteristicExists(
      device,
      serviceUuid,
      characteristicUuid,
      name,
      onMessage,
    );

    if (!canMonitor) {
      // Retorna função vazia se não puder monitorar
      return () => {
        // Nada para limpar
      };
    }

    onMessage(`🔔 Iniciando monitoramento de ${name}...`);

    // A biblioteca react-native-ble-plx habilita notificações automaticamente
    subscription = device.monitorCharacteristicForService(
      serviceUuid,
      characteristicUuid,
      (error, characteristic) => {
        if (error) {
          onMessage(
            `❌ Erro no monitoramento de ${name}: ${error?.message || String(error)}`,
          );
          return;
        }

        const value = characteristic?.value || null;
        onMessage(`🔔 ${name} - Notificação recebida (base64): ${value || 'null'}`);

        if (onData && value) {
          onData(value);
        }
      },
    );

    onMessage(`✅ Monitoramento de ${name} iniciado com sucesso`);
  } catch (error: any) {
    // Captura erros de forma segura para não crashar o app
    const errorMsg = error?.message || String(error);
    onMessage(
      `⚠️ Não foi possível iniciar monitoramento de ${name}: ${errorMsg}`,
    );
    
    // Se for erro de característica não encontrada, apenas logamos
    if (errorMsg.includes('Characteristic') || errorMsg.includes('not found')) {
      onMessage(`ℹ️ ${name} não está disponível no dispositivo`);
    }
  }

  return () => {
    if (subscription) {
      try {
        subscription.remove();
        onMessage(`🛑 Monitoramento de ${name} parado`);
      } catch (e) {
        // Ignora erros ao remover subscription
      }
    }
  };
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

    // 4. Monitora resultado do pré-teste (NOTIFY) - de forma assíncrona e segura
    try {
      const stopResultado = await monitorCharacteristic(
        device,
        PRE_TEST_SERVICE_UUID,
        PRETESTE_RESULTADO_UUID,
        'Resultado do Pré-teste',
        onMessage,
        (value) => {
          if (value) {
            const status = parsePreTestStatusFromBase64(value);
            if (status) {
              onMessage(
                `🔔 Resultado recebido: ${status.phase} | Byte: 0x${status.rawByte.toString(16).padStart(2, '0')}`,
              );
            }
          }
        },
      );
      stopFunctions.push(stopResultado);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar Resultado do Pré-teste: ${error?.message || String(error)}`,
      );
    }

    // 5. Monitora erros de análise (NOTIFY) - de forma assíncrona e segura
    try {
      const stopErro = await monitorCharacteristic(
        device,
        PRE_TEST_SERVICE_UUID,
        ERRO_ANALISE_UUID,
        'Erro de Análise',
        onMessage,
        (value) => {
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
      );
      stopFunctions.push(stopErro);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar Erro de Análise: ${error?.message || String(error)}`,
      );
    }

    // 6. Monitora sucesso de análise (NOTIFY) - de forma assíncrona e segura
    try {
      const stopSucesso = await monitorCharacteristic(
        device,
        PRE_TEST_SERVICE_UUID,
        SUCESSO_ANALISE_UUID,
        'Sucesso de Análise',
        onMessage,
        (value) => {
          onMessage(`🔔 ✅ SUCESSO: Análise concluída! (base64: ${value || 'null'})`);
        },
      );
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