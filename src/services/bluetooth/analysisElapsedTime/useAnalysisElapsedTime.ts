import { useEffect, useState, useCallback, useRef } from 'react';
import type { Device } from 'react-native-ble-plx';
import { useBluetooth } from '@/contexts/BluetoothContext';
import {
  monitorAnalysisElapsedTime,
  type AnalysisElapsedTimeStatus,
} from './analysisElapsedTimeReader';
import { EQUIPMENT_STATUS_SERVICE_UUID } from '../equipmentStatus/equipmentStatusProtocol';
import { logger } from '@services/logging';

export interface UseAnalysisElapsedTimeResult {
  /** Tempo decorrido em segundos (calculado de hours * 60 + minutes) */
  elapsedSeconds: number | null;
  /** Status completo do tempo decorrido */
  status: AnalysisElapsedTimeStatus | null;
  /** Se está monitorando */
  isMonitoring: boolean;
  /** Erro, se houver */
  error: string | null;
}

/**
 * Hook customizado para monitorar o tempo decorrido da análise em tempo real via BLE.
 * Automaticamente obtém o Device conectado e inicia o monitoramento.
 * 
 * @returns {UseAnalysisElapsedTimeResult} Objeto com tempo decorrido, estado de monitoramento e erro
 */
export function useAnalysisElapsedTime(): UseAnalysisElapsedTimeResult {
  const [status, setStatus] = useState<AnalysisElapsedTimeStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connectedDevice,
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  const stopMonitorRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Obtém o Device conectado usando múltiplas estratégias de fallback.
   */
  const getConnectedDevice = useCallback(async (): Promise<Device | null> => {
    if (!connectedDevice || !bleManager || !bleManagerAvailable) {
      console.log('[useAnalysisElapsedTime] Nenhum dispositivo conectado');
      return null;
    }

    try {
      const managerReady = await ensureBleManagerReady();
      if (!managerReady || !bleManager) {
        return null;
      }

      const deviceId = connectedDevice.id;
      const alreadyConnected = await bleManager.isDeviceConnected(deviceId);

      let device: Device | null = null;

      if (alreadyConnected) {
        // Tentar via connectedDevices
        try {
          const byService = await bleManager.connectedDevices([
            EQUIPMENT_STATUS_SERVICE_UUID,
          ]);
          device = byService.find(d => d.id === deviceId) || null;
        } catch (e) {
          console.warn('[useAnalysisElapsedTime] Erro connectedDevices:', e);
        }

        // Fallback: devices([id])
        if (!device) {
          try {
            const byId = await bleManager.devices([deviceId]);
            if (byId && byId.length > 0 && byId[0]) {
              device = byId[0];
            }
          } catch (e) {
            console.warn('[useAnalysisElapsedTime] Erro devices:', e);
          }
        }

        // Último recurso: connectToDevice
        if (!device) {
          try {
            device = await bleManager.connectToDevice(deviceId, {
              autoConnect: true,
            });
          } catch (e: any) {
            console.warn('[useAnalysisElapsedTime] Erro connectToDevice:', e?.message);
          }
        }
      } else {
        // Reconectar se necessário
        try {
          device = await bleManager.connectToDevice(deviceId, {
            autoConnect: true,
          });
          await device.discoverAllServicesAndCharacteristics();
        } catch (e: any) {
          console.warn('[useAnalysisElapsedTime] Erro ao reconectar:', e?.message);
        }
      }

      if (!device) return null;

      const isConnected = await device.isConnected();
      return isConnected ? device : null;
    } catch (error: any) {
      console.error('[useAnalysisElapsedTime] Erro ao obter Device:', error?.message || error);
      return null;
    }
  }, [connectedDevice, bleManager, bleManagerAvailable, ensureBleManagerReady]);

  // Iniciar monitoramento quando o hook for montado
  useEffect(() => {
    isMountedRef.current = true;

    const startMonitoring = async () => {
      if (!connectedDevice) {
        console.log('[useAnalysisElapsedTime] Nenhum dispositivo conectado, não iniciando monitoramento');
        setIsMonitoring(false);
        setStatus(null);
        setError(null);
        return;
      }

      try {
        setIsMonitoring(true);
        setError(null);

        const device = await getConnectedDevice();
        if (!device) {
          throw new Error('Dispositivo não conectado');
        }

        console.log('[useAnalysisElapsedTime] Iniciando monitoramento do tempo decorrido...');

        // Callback de log
        const onMessage = (msg: string) => {
          console.log(`[useAnalysisElapsedTime] ${msg}`);
          logger.info(msg, {}, 'bluetooth');
        };

        // Callback quando o tempo decorrido é atualizado
        const onElapsedTimeUpdate = (elapsedStatus: AnalysisElapsedTimeStatus) => {
          if (isMountedRef.current) {
            console.log(
              `[useAnalysisElapsedTime] ⏱️ Tempo decorrido atualizado: ${elapsedStatus.hours}h${elapsedStatus.minutes.toString().padStart(2, '0')} (${elapsedStatus.totalMinutes}min)`,
            );
            setStatus(elapsedStatus);
          }
        };

        // Iniciar monitoramento
        const stopMonitor = await monitorAnalysisElapsedTime(
          device,
          onMessage,
          onElapsedTimeUpdate,
        );

        stopMonitorRef.current = stopMonitor;
        console.log('[useAnalysisElapsedTime] ✅ Monitoramento iniciado');

      } catch (error: any) {
        const errorMsg = error?.message || 'Erro desconhecido';
        console.error('[useAnalysisElapsedTime] ❌ Erro ao iniciar monitoramento:', errorMsg);
        setError(errorMsg);
        setIsMonitoring(false);
        setStatus(null);
      }
    };

    startMonitoring();

    // Cleanup: parar monitoramento quando desmontar
    return () => {
      isMountedRef.current = false;
      console.log('[useAnalysisElapsedTime] Parando monitoramento...');

      if (stopMonitorRef.current) {
        try {
          stopMonitorRef.current();
          stopMonitorRef.current = null;
        } catch (e) {
          console.warn('[useAnalysisElapsedTime] Erro ao parar monitoramento:', e);
        }
      }

      setIsMonitoring(false);
      setStatus(null);
    };
  }, [connectedDevice, getConnectedDevice]);

  // Calcular elapsedSeconds a partir do status
  const elapsedSeconds = status ? status.totalMinutes * 60 : null;

  return {
    elapsedSeconds,
    status,
    isMonitoring,
    error,
  };
}

