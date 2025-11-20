import type { Device } from 'react-native-ble-plx';
import { TEMPERATURE_BLOCK_SERVICE_UUID, base64ToBytes } from './temperatureBlockProtocol';
import {
  TEMPO_AQUECIMENTO_BLOCO_UUID,
  parseHeatingTimeFromBase64,
  type TemperatureBlockHeatingTimeStatus,
} from './temperatureBlockHeatingProtocol';

export async function readTemperatureBlockHeatingTime(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<TemperatureBlockHeatingTimeStatus | null> {
  try {
    const isConnected = await device.isConnected();
    if (!isConnected) {
      onMessage('⚠️ Dispositivo não está conectado, pulando leitura do tempo de aquecimento');
      return null;
    }

    onMessage(
      `📖 Lendo tempo de aquecimento do bloco (UUID: ${TEMPO_AQUECIMENTO_BLOCO_UUID})...`,
    );

    let characteristic;
    try {
      characteristic = await device.readCharacteristicForService(
        TEMPERATURE_BLOCK_SERVICE_UUID,
        TEMPO_AQUECIMENTO_BLOCO_UUID,
      );
      
      // Log detalhado para o desenvolvedor do hardware - conversão big-endian
      if (characteristic.value) {
        const base64Value = characteristic.value;
        const bytes = base64ToBytes(base64Value);
        
        // Converte bytes para ArrayBuffer e lê como float32 big-endian
        const buffer = new ArrayBuffer(bytes.length);
        const view = new DataView(buffer);
        bytes.forEach((byte, index) => {
          view.setUint8(index, byte);
        });
        
        // Lê como float32 big-endian (false = big-endian)
        const floatBigEndian = view.getFloat32(0, false);
        
        // Lê como float32 little-endian para comparação (true = little-endian)
        const floatLittleEndian = view.getFloat32(0, true);
        
        // Formata bytes em hex
        const bytesHex = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
        const bytesArray = `[${bytes.map(b => b.toString()).join(', ')}]`;
        
        console.log('[DEBUG Hardware - Tempo Aquecimento] Base64 recebido:', base64Value);
        console.log('[DEBUG Hardware - Tempo Aquecimento] Bytes decodificados:', bytesArray);
        console.log('[DEBUG Hardware - Tempo Aquecimento] Bytes em hex:', bytesHex);
        console.log('[DEBUG Hardware - Tempo Aquecimento] Float32 BIG-ENDIAN:', floatBigEndian);
        console.log('[DEBUG Hardware - Tempo Aquecimento] Float32 LITTLE-ENDIAN (comparação):', floatLittleEndian);
        console.log('[DEBUG Hardware - Tempo Aquecimento] Valor (big-endian):', floatBigEndian.toFixed(2));
      }
      
    } catch (readError: any) {
      const readErrorMsg = readError?.message || String(readError) || '';
      const readErrorString = String(readError).toLowerCase();

      if (
        readErrorMsg.includes('GATT_ERROR') ||
        readErrorMsg.includes('status 133') ||
        readErrorMsg.includes('0x85') ||
        readErrorMsg.includes('not connected') ||
        readErrorMsg.includes('disconnected') ||
        readErrorString.includes('gatt') ||
        readErrorString.includes('nullpointerexception')
      ) {
        return null;
      }
      throw readError;
    }

    const value = characteristic.value;
    onMessage(`📊 Tempo de aquecimento RAW (base64): ${value || 'null'}`);

    if (!value) {
      onMessage('⚠️ Tempo de aquecimento vazio (característica não retornou dados)');
      return null;
    }

    const status = parseHeatingTimeFromBase64(value);
    if (!status) {
      onMessage('⚠️ Não foi possível fazer parse do tempo de aquecimento do bloco');
      return null;
    }

    const [hourByte, minuteByte] = status.rawBytes;
    const bytesStr = `[0x${hourByte!.toString(16).padStart(2, '0')}, 0x${minuteByte!
      .toString(16)
      .padStart(2, '0')}]`;

    onMessage(
      `✅ Tempo de aquecimento do bloco: ${status.hours}h${status.minutes
        .toString()
        .padStart(2, '0')} (total ${status.totalMinutes} minutos) | Hex: ${
        status.hexValue
      } | Bytes: ${bytesStr}`,
    );

    return status;
  } catch (error: any) {
    const errorMsg = error?.message || String(error) || '';
    const errorString = String(error).toLowerCase();

    if (
      errorMsg.includes('GATT_ERROR') ||
      errorMsg.includes('status 133') ||
      errorMsg.includes('0x85') ||
      errorMsg.includes('not connected') ||
      errorMsg.includes('disconnected') ||
      errorString.includes('gatt') ||
      errorString.includes('nullpointerexception')
    ) {
      return null;
    }

    onMessage(`❌ Erro ao ler tempo de aquecimento do bloco: ${errorMsg}`);
    return null;
  }
}

export async function monitorTemperatureBlockHeatingTime(
  device: Device,
  onMessage: (msg: string) => void,
  onHeatingTimeUpdate?: (status: TemperatureBlockHeatingTimeStatus) => void,
  intervalMs: number = 5000,
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
        // ignore
      }
      disconnectSubscription = null;
    }
  };

  try {
    onMessage(`🔔 Iniciando monitoramento do tempo de aquecimento do bloco...`);

    disconnectSubscription = device.onDisconnected(() => {
      onMessage('⚠️ Dispositivo desconectado, parando monitoramento do tempo de aquecimento');
      stopMonitoring();
    });

    const readHeatingTime = async () => {
      if (!isMonitoring) return;

      try {
        const isConnected = await device.isConnected();
        if (!isConnected) {
          onMessage('⚠️ Dispositivo desconectado, parando monitoramento do tempo de aquecimento');
          stopMonitoring();
          return;
        }

        const status = await readTemperatureBlockHeatingTime(device, onMessage);
        if (status && onHeatingTimeUpdate) {
          onHeatingTimeUpdate(status);
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error) || '';
        const errorString = String(error).toLowerCase();

        if (
          errorMsg.includes('GATT_ERROR') ||
          errorMsg.includes('status 133') ||
          errorMsg.includes('0x85') ||
          errorMsg.includes('not connected') ||
          errorMsg.includes('disconnected') ||
          errorString.includes('gatt') ||
          errorString.includes('ble') ||
          errorString.includes('nullpointerexception')
        ) {
          onMessage(
            '⚠️ Erro de conexão detectado, parando monitoramento do tempo de aquecimento',
          );
          stopMonitoring();
        } else {
          onMessage(`⚠️ Erro ao ler tempo de aquecimento: ${errorMsg}`);
        }
      }
    };

    await readHeatingTime();

    if (isMonitoring) {
      intervalId = setInterval(readHeatingTime, intervalMs);
      onMessage(
        `✅ Monitoramento do tempo de aquecimento iniciado (lendo a cada ${intervalMs}ms)`,
      );
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    onMessage(
      `⚠️ Não foi possível iniciar monitoramento do tempo de aquecimento: ${errorMsg}`,
    );
    stopMonitoring();
  }

  return () => {
    stopMonitoring();
    onMessage(`🛑 Monitoramento do tempo de aquecimento parado`);
  };
}

