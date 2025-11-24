import { useCallback, useState } from 'react';
import type { Device } from 'react-native-ble-plx';
import { useBluetooth } from '@/contexts/BluetoothContext';
import { writeStartAnalysis } from './startAnalysisWriter';
import { START_ANALYSIS_SERVICE_UUID } from './startAnalysisProtocol';
import { logger } from '@services/logging';

export interface UseStartAnalysisResult {
  startAnalysis: () => Promise<boolean>;
  isStarting: boolean;
  error: string | null;
}

/**
 * Hook customizado para enviar comando de iniciar/parar análise ao hardware via BLE.
 * Encapsula a lógica de recuperação do Device conectado e envio do comando.
 * 
 * @returns {UseStartAnalysisResult} Objeto com função de iniciar análise, estado de loading e erro
 */
export function useStartAnalysis(): UseStartAnalysisResult {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connectedDevice,
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  /**
   * Obtém o Device BLE conectado usando múltiplas estratégias de fallback.
   * Mesma lógica utilizada na BluetoothConnectionScreen para garantir compatibilidade.
   */
  const getConnectedDevice = useCallback(async (): Promise<Device | null> => {
    if (!connectedDevice || !bleManager || !bleManagerAvailable) {
      console.log('[useStartAnalysis] Nenhum dispositivo conectado ou manager não disponível');
      return null;
    }

    try {
      const managerReady = await ensureBleManagerReady();
      if (!managerReady || !bleManager) {
        console.log('[useStartAnalysis] Manager não está pronto');
        return null;
      }

      const deviceId = connectedDevice.id;
      
      // Verificar se está conectado
      const alreadyConnected = await bleManager.isDeviceConnected(deviceId);
      console.log(`[useStartAnalysis] isDeviceConnected(${deviceId}) = ${alreadyConnected}`);

      let device: Device | null = null;

      if (alreadyConnected) {
        // 1) Tentar obter via connectedDevices
        try {
          const byService = await bleManager.connectedDevices([
            START_ANALYSIS_SERVICE_UUID,
          ]);
          const foundById = byService.find(d => d.id === deviceId);
          if (foundById) {
            device = foundById;
            console.log('[useStartAnalysis] ✅ Device encontrado via connectedDevices');
          }
        } catch (e) {
          console.warn('[useStartAnalysis] Erro ao buscar connectedDevices:', e);
        }

        // 2) Fallback: tentar via devices([id])
        if (!device) {
          try {
            const byId = await bleManager.devices([deviceId]);
            if (byId && byId.length > 0 && byId[0]) {
              device = byId[0];
              console.log('[useStartAnalysis] ✅ Device encontrado via devices([id])');
            }
          } catch (e) {
            console.warn('[useStartAnalysis] Erro ao buscar devices([id]):', e);
          }
        }

        // 3) Último recurso: conectar novamente
        if (!device) {
          try {
            device = await bleManager.connectToDevice(deviceId, {
              autoConnect: true,
            });
            await device.discoverAllServicesAndCharacteristics();
            console.log('[useStartAnalysis] ✅ Device reconectado via connectToDevice');
          } catch (e: any) {
            console.warn('[useStartAnalysis] Erro ao reconectar:', e?.message);
          }
        }
      } else {
        // Reconectar se necessário
        try {
          device = await bleManager.connectToDevice(deviceId, {
            autoConnect: true,
          });
          await device.discoverAllServicesAndCharacteristics();
          console.log('[useStartAnalysis] ✅ Device conectado');
        } catch (e: any) {
          console.warn('[useStartAnalysis] Erro ao conectar:', e?.message);
        }
      }

      if (!device) return null;

      const isConnected = await device.isConnected();
      return isConnected ? device : null;
    } catch (error: any) {
      console.error('[useStartAnalysis] Erro ao obter Device:', error?.message || error);
      return null;
    }
  }, [connectedDevice, bleManager, bleManagerAvailable, ensureBleManagerReady]);

  /**
   * Envia comando para iniciar/parar análise no hardware
   */
  const startAnalysis = useCallback(async (): Promise<boolean> => {
    if (isStarting) {
      console.log('[useStartAnalysis] Já está iniciando análise, ignorando...');
      return false;
    }

    setIsStarting(true);
    setError(null);

    try {
      const device = await getConnectedDevice();
      if (!device) {
        const errorMsg = 'Dispositivo não conectado';
        setError(errorMsg);
        logger.error(errorMsg, {}, 'bluetooth');
        return false;
      }

      console.log('[useStartAnalysis] Enviando comando de iniciar análise...');

      const onMessage = (msg: string) => {
        console.log(`[useStartAnalysis] ${msg}`);
        logger.info(msg, {}, 'bluetooth');
      };

      const result = await writeStartAnalysis(device, onMessage);

      if (!result || !result.success) {
        const errorMsg = 'Falha ao enviar comando de iniciar análise';
        setError(errorMsg);
        logger.error(errorMsg, {}, 'bluetooth');
        return false;
      }

      console.log('[useStartAnalysis] ✅ Comando de iniciar análise enviado com sucesso');
      return true;
    } catch (error: any) {
      const errorMsg = error?.message || 'Erro desconhecido ao iniciar análise';
      setError(errorMsg);
      console.error('[useStartAnalysis] ❌ Erro:', errorMsg);
      logger.error(errorMsg, { error }, 'bluetooth');
      return false;
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, getConnectedDevice]);

  return {
    startAnalysis,
    isStarting,
    error,
  };
}
