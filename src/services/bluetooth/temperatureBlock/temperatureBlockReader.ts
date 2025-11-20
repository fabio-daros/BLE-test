import type { Device } from 'react-native-ble-plx';
import {
  TEMPERATURE_BLOCK_SERVICE_UUID,
  TEMPERATURA_BLOCO_UUID,
  parseTemperatureBlockFromBase64,
} from './temperatureBlockProtocol';
import type { TemperatureBlockHeatingTimeStatus } from './temperatureBlockHeatingProtocol';
import {
  readTemperatureBlockHeatingTime,
  monitorTemperatureBlockHeatingTime,
} from './temperatureBlockHeatingReader';

export {
  readTemperatureBlockHeatingTime,
  monitorTemperatureBlockHeatingTime,
};
export type { TemperatureBlockHeatingTimeStatus };

export interface TemperatureBlockSubscriptions {
  stop: () => void;
}

/**
 * Lê a temperatura atual do bloco (característica READ)
 */
export async function readTemperatureBlock(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<number | null> {
  try {
    // Verifica se o dispositivo está conectado antes de tentar ler
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando leitura da temperatura');
      return null;
    }

    onMessage(`📖 Lendo temperatura do bloco (UUID: ${TEMPERATURA_BLOCO_UUID})...`);
    
    // Wrapper de segurança para capturar erros da biblioteca nativa
    let characteristic;
    try {
      characteristic = await device.readCharacteristicForService(
        TEMPERATURE_BLOCK_SERVICE_UUID,
        TEMPERATURA_BLOCO_UUID,
      );
      console.log('[Diego] characteristic', characteristic.value);
    } catch (readError: any) {
      // Se der erro na leitura, verifica se é erro de conexão
      const readErrorMsg = readError?.message || String(readError) || '';
      const readErrorString = String(readError).toLowerCase();
      
      if (readErrorMsg.includes('GATT_ERROR') || 
          readErrorMsg.includes('status 133') ||
          readErrorMsg.includes('0x85') ||
          readErrorMsg.includes('not connected') ||
          readErrorMsg.includes('disconnected') ||
          readErrorString.includes('gatt') ||
          readErrorString.includes('nullpointerexception')) {
        // Erro de conexão - retorna silenciosamente
        return null;
      }
      // Re-lança outros erros para serem tratados no catch externo
      throw readError;
    }

    const value = characteristic.value;
    onMessage(`📊 Temperatura RAW (base64): ${value || 'null'}`);

    if (value) {
      const status = parseTemperatureBlockFromBase64(value);
      if (status) {
        const byte1Hex = status.rawBytes[0]!.toString(16).padStart(2, '0');
        const byte2Hex = status.rawBytes.length >= 2 
          ? status.rawBytes[1]!.toString(16).padStart(2, '0')
          : '00';
        const bytesStr = status.rawBytes.length >= 2
          ? `[0x${byte1Hex}, 0x${byte2Hex}]`
          : `[0x${byte1Hex}]`;
        
        const signStr = status.isPositive ? '+' : '-';
        onMessage(
          `✅ Temperatura do Bloco: ${signStr}${status.temperature}°C | ` +
            `Hex: ${status.hexValue} | ` +
            `Bytes: ${bytesStr} | ` +
            `Sinal: ${status.isPositive ? 'Positivo' : 'Negativo'}`,
        );
        return status.temperature;
      } else {
        onMessage('⚠️ Não foi possível fazer parse da temperatura do bloco');
        return null;
      }
    } else {
      onMessage('⚠️ Temperatura vazia (característica não retornou dados)');
      return null;
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
      // Erro de conexão - não loga para não poluir, apenas retorna null
      return null;
    }
    // Outros erros são logados
    onMessage(
      `❌ Erro ao ler temperatura do bloco: ${errorMsg}`,
    );
    return null;
  }
}

/**
 * Monitora a temperatura do bloco (leitura periódica)
 */
export async function monitorTemperatureBlock(
  device: Device,
  onMessage: (msg: string) => void,
  onTemperatureUpdate?: (temperature: number) => void,
  intervalMs: number = 5000, // Lê a cada 5 segundos por padrão
): Promise<() => void> {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isMonitoring = true;
  let disconnectSubscription: any = null;

  const stopMonitoring = () => {
    if (!isMonitoring) return;
    isMonitoring = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (disconnectSubscription) {
      try {
        disconnectSubscription.remove();
      } catch (e) {
        // Ignora erros ao remover subscription
      }
      disconnectSubscription = null;
    }
  };

  try {
    onMessage(`🔔 Iniciando monitoramento da temperatura do bloco...`);
    
    // Listener de desconexão para parar imediatamente
    disconnectSubscription = device.onDisconnected(() => {
      onMessage('⚠️ Dispositivo desconectado, parando monitoramento da temperatura');
      stopMonitoring();
    });
    
    // Função para ler a temperatura
    const readTemperature = async () => {
      if (!isMonitoring) return;
      
      try {
        // Verifica conexão antes de ler
        const isConnected = await device.isConnected();
        if (!isConnected) {
          onMessage('⚠️ Dispositivo desconectado, parando monitoramento da temperatura');
          stopMonitoring();
          return;
        }
        
        const temperature = await readTemperatureBlock(device, onMessage);
        if (temperature !== null && onTemperatureUpdate) {
          onTemperatureUpdate(temperature);
        }
      } catch (error: any) {
        // Captura qualquer erro e para o monitoramento se for erro de conexão
        const errorMsg = error?.message || String(error) || '';
        const errorString = String(error).toLowerCase();
        
        if (errorMsg.includes('GATT_ERROR') || 
            errorMsg.includes('status 133') ||
            errorMsg.includes('0x85') ||
            errorMsg.includes('not connected') ||
            errorMsg.includes('disconnected') ||
            errorString.includes('gatt') ||
            errorString.includes('ble') ||
            errorString.includes('nullpointerexception')) {
          onMessage('⚠️ Erro de conexão detectado, parando monitoramento da temperatura');
          stopMonitoring();
        } else {
          // Outros erros são logados mas não param o monitoramento
          onMessage(`⚠️ Erro ao ler temperatura: ${errorMsg}`);
        }
      }
    };

    // Lê imediatamente
    await readTemperature();

    // Configura leitura periódica apenas se ainda estiver monitorando
    if (isMonitoring) {
      intervalId = setInterval(readTemperature, intervalMs);
      onMessage(`✅ Monitoramento da temperatura iniciado (lendo a cada ${intervalMs}ms)`);
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    onMessage(
      `⚠️ Não foi possível iniciar monitoramento da temperatura: ${errorMsg}`,
    );
    stopMonitoring();
  }

  return () => {
    stopMonitoring();
    onMessage(`🛑 Monitoramento da temperatura parado`);
  };
}


/**
 * Anexa monitoramento da temperatura do bloco
 */
export async function attachTemperatureBlockMonitors(
  device: Device,
  onMessage: (msg: string) => void,
  onTemperatureUpdate?: (temperature: number) => void,
  onHeatingTimeUpdate?: (status: TemperatureBlockHeatingTimeStatus) => void,
): Promise<TemperatureBlockSubscriptions> {
  const stopFunctions: Array<() => void> = [];

  try {
    onMessage('🚀 attachTemperatureBlockMonitors chamado!');
    onMessage(`🔍 Service UUID: ${TEMPERATURE_BLOCK_SERVICE_UUID}`);
    onMessage('=== Iniciando monitoramento da temperatura do bloco ===');

    // 1. Leitura inicial da temperatura (READ)
    await readTemperatureBlock(device, onMessage);

    // 2. Leitura inicial do tempo de aquecimento (READ)
    await readTemperatureBlockHeatingTime(device, onMessage);

    // 3. Monitora temperatura do bloco (leitura periódica)
    try {
      const stopMonitor = await monitorTemperatureBlock(
        device,
        onMessage,
        onTemperatureUpdate,
      );
      stopFunctions.push(stopMonitor);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar temperatura do bloco: ${error?.message || String(error)}`,
      );
    }

    // 4. Monitora tempo de aquecimento
    try {
      const stopMonitorHeating = await monitorTemperatureBlockHeatingTime(
        device,
        onMessage,
        onHeatingTimeUpdate,
      );
      stopFunctions.push(stopMonitorHeating);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar tempo de aquecimento do bloco: ${error?.message || String(error)}`,
      );
    }

    onMessage('✅ Monitoramentos do bloco foram anexados');

    return {
      stop: () => {
        onMessage('🛑 Parando monitoramento da temperatura...');
        stopFunctions.forEach(stop => {
          try {
            stop();
          } catch (e) {
            // ignore
          }
        });
        onMessage('✅ Monitoramento da temperatura finalizado');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitoramento da temperatura: ${error?.message || String(error)}`,
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
        onMessage('Monitoramento já foi limpo devido a erro');
      },
    };
  }
}

export function detachTemperatureBlockMonitors(
  subs: TemperatureBlockSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitoramento da temperatura: ${e?.message || String(e)}`);
  }
}

