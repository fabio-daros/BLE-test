import type { Device } from 'react-native-ble-plx';
import {
  BATTERY_STATS_SERVICE_UUID,
  STATUS_BATERIA_UUID,
  parseBatteryStatusFromBase64,
} from './batteryStatsProtocol';

export interface BatteryStatsSubscriptions {
  stop: () => void;
}

/**
 * Lê o status atual da bateria (característica READ)
 */
export async function readBatteryStatus(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<number | null> {
  try {
    // Verifica se o dispositivo está conectado antes de tentar ler
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando leitura da bateria');
      return null;
    }

    onMessage(`📖 Lendo status da bateria (UUID: ${STATUS_BATERIA_UUID})...`);
    
    // Wrapper de segurança para capturar erros da biblioteca nativa
    let characteristic;
    try {
      characteristic = await device.readCharacteristicForService(
        BATTERY_STATS_SERVICE_UUID,
        STATUS_BATERIA_UUID,
      );
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
    onMessage(`📊 Status RAW (base64): ${value || 'null'}`);

    if (value) {
      const status = parseBatteryStatusFromBase64(value);
      if (status) {
        const byte1Hex = status.rawBytes[0]!.toString(16).padStart(2, '0');
        const byte2Hex = status.rawBytes.length >= 2 
          ? status.rawBytes[1]!.toString(16).padStart(2, '0')
          : '00';
        const bytesStr = status.rawBytes.length >= 2
          ? `[0x${byte1Hex}, 0x${byte2Hex}]`
          : `[0x${byte1Hex}]`;
        
        onMessage(
          `✅ Status da Bateria: ${status.percentage}% | ` +
            `Hex: ${status.hexValue} | ` +
            `Bytes: ${bytesStr}`,
        );
        return status.percentage;
      } else {
        onMessage('⚠️ Não foi possível fazer parse do status da bateria');
        return null;
      }
    } else {
      onMessage('⚠️ Status vazio (característica não retornou dados)');
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
      `❌ Erro ao ler status da bateria: ${errorMsg}`,
    );
    return null;
  }
}

/**
 * Monitora o status da bateria (se suportar NOTIFY)
 * Como a característica é apenas READ, esta função tenta ler periodicamente
 */
export async function monitorBatteryStatus(
  device: Device,
  onMessage: (msg: string) => void,
  onBatteryUpdate?: (percentage: number) => void,
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
    onMessage(`🔔 Iniciando monitoramento do status da bateria...`);
    
    // Listener de desconexão para parar imediatamente
    disconnectSubscription = device.onDisconnected(() => {
      onMessage('⚠️ Dispositivo desconectado, parando monitoramento da bateria');
      stopMonitoring();
    });
    
    // Função para ler o status
    const readStatus = async () => {
      if (!isMonitoring) return;
      
      try {
        // Verifica conexão antes de ler
        const isConnected = await device.isConnected();
        if (!isConnected) {
          onMessage('⚠️ Dispositivo desconectado, parando monitoramento da bateria');
          stopMonitoring();
          return;
        }
        
        const percentage = await readBatteryStatus(device, onMessage);
        if (percentage !== null && onBatteryUpdate) {
          onBatteryUpdate(percentage);
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
          onMessage('⚠️ Erro de conexão detectado, parando monitoramento da bateria');
          stopMonitoring();
        } else {
          // Outros erros são logados mas não param o monitoramento
          onMessage(`⚠️ Erro ao ler bateria: ${errorMsg}`);
        }
      }
    };

    // Lê imediatamente
    await readStatus();

    // Configura leitura periódica apenas se ainda estiver monitorando
    if (isMonitoring) {
      intervalId = setInterval(readStatus, intervalMs);
      onMessage(`✅ Monitoramento da bateria iniciado (lendo a cada ${intervalMs}ms)`);
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    onMessage(
      `⚠️ Não foi possível iniciar monitoramento da bateria: ${errorMsg}`,
    );
    stopMonitoring();
  }

  return () => {
    stopMonitoring();
    onMessage(`🛑 Monitoramento da bateria parado`);
  };
}

/**
 * Anexa monitoramento do status da bateria
 */
export async function attachBatteryStatsMonitors(
  device: Device,
  onMessage: (msg: string) => void,
  onBatteryUpdate?: (percentage: number) => void,
): Promise<BatteryStatsSubscriptions> {
  const stopFunctions: Array<() => void> = [];

  try {
    onMessage('🚀 attachBatteryStatsMonitors chamado!');
    onMessage(`🔍 Service UUID: ${BATTERY_STATS_SERVICE_UUID}`);
    onMessage('=== Iniciando monitoramento do status da bateria ===');

    // 1. Leitura inicial do status (READ)
    await readBatteryStatus(device, onMessage);

    // 2. Monitora status da bateria (leitura periódica)
    try {
      const stopMonitor = await monitorBatteryStatus(
        device,
        onMessage,
        onBatteryUpdate,
      );
      stopFunctions.push(stopMonitor);
    } catch (error: any) {
      onMessage(
        `⚠️ Não foi possível monitorar status da bateria: ${error?.message || String(error)}`,
      );
    }

    onMessage('✅ Monitoramento do status da bateria foi anexado');

    return {
      stop: () => {
        onMessage('🛑 Parando monitoramento da bateria...');
        stopFunctions.forEach(stop => {
          try {
            stop();
          } catch (e) {
            // ignore
          }
        });
        onMessage('✅ Monitoramento da bateria finalizado');
      },
    };
  } catch (error: any) {
    onMessage(
      `❌ Erro ao anexar monitoramento da bateria: ${error?.message || String(error)}`,
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

export function detachBatteryStatsMonitors(
  subs: BatteryStatsSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch (e: any) {
    onMessage(`Erro ao desanexar monitoramento da bateria: ${e?.message || String(e)}`);
  }
}

