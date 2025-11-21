import { useEffect, useState, useCallback, useRef } from 'react';
import type { Device } from 'react-native-ble-plx';
import { useBluetooth } from '@/contexts/BluetoothContext';
import {
  attachEquipmentStatusMonitors,
  detachEquipmentStatusMonitors,
  type EquipmentStatusSubscriptions,
} from './equipmentStatusReader';
import { TEMPERATURE_BLOCK_SERVICE_UUID } from '../temperatureBlock/temperatureBlockProtocol';
import { logger } from '@services/logging';
import type { EquipmentStatusType } from './equipmentStatusProtocol';

export interface UseEquipmentStatusMonitoringResult {
  status: EquipmentStatusType | null;
  isMonitoring: boolean;
  error: string | null;
}

/**
 * Hook customizado para monitorar o status do equipamento em tempo real via BLE.
 * Automaticamente obtém o Device conectado e inicia o monitoramento.
 * 
 * @returns {UseEquipmentStatusMonitoringResult} Objeto com status atual, estado de monitoramento e erro
 */
export function useEquipmentStatusMonitoring(): UseEquipmentStatusMonitoringResult {
  const [status, setStatus] = useState<EquipmentStatusType | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connectedDevice,
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  const subscriptionsRef = useRef<EquipmentStatusSubscriptions | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Obtém o Device conectado usando múltiplas estratégias de fallback.
   */
  const getConnectedDevice = useCallback(async (): Promise<Device | null> => {
    if (!connectedDevice || !bleManager || !bleManagerAvailable) {
      console.log('[useEquipmentStatusMonitoring] Nenhum dispositivo conectado');
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
            TEMPERATURE_BLOCK_SERVICE_UUID,
          ]);
          device = byService.find(d => d.id === deviceId) || null;
        } catch (e) {
          console.warn('[useEquipmentStatusMonitoring] Erro connectedDevices:', e);
        }

        // Fallback: devices([id])
        if (!device) {
          try {
            const byId = await bleManager.devices([deviceId]);
            if (byId && byId.length > 0 && byId[0]) {
              device = byId[0];
            }
          } catch (e) {
            console.warn('[useEquipmentStatusMonitoring] Erro devices:', e);
          }
        }

        // Último recurso: connectToDevice
        if (!device) {
          try {
            device = await bleManager.connectToDevice(deviceId, {
              autoConnect: true,
            });
          } catch (e: any) {
            console.warn('[useEquipmentStatusMonitoring] Erro connectToDevice:', e?.message);
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
          console.warn('[useEquipmentStatusMonitoring] Erro ao reconectar:', e?.message);
        }
      }

      if (!device) return null;

      const isConnected = await device.isConnected();
      return isConnected ? device : null;
    } catch (error: any) {
      console.error('[useEquipmentStatusMonitoring] Erro ao obter Device:', error?.message || error);
      return null;
    }
  }, [connectedDevice, bleManager, bleManagerAvailable, ensureBleManagerReady]);

  // Iniciar monitoramento quando o hook for montado
  useEffect(() => {
    isMountedRef.current = true;

    const startMonitoring = async () => {
      if (!connectedDevice) {
        console.log('[useEquipmentStatusMonitoring] Nenhum dispositivo conectado, não iniciando monitoramento');
        setIsMonitoring(false);
        setStatus(null);
        return;
      }

      try {
        setIsMonitoring(true);
        setError(null);

        const device = await getConnectedDevice();
        if (!device) {
          throw new Error('Dispositivo não conectado');
        }

        console.log('[useEquipmentStatusMonitoring] Iniciando monitoramento do status...');

        // Callback de log
        const onMessage = (msg: string) => {
          console.log(`[useEquipmentStatusMonitoring] ${msg}`);
          logger.info(msg, {}, 'bluetooth');
        };

        // Callback quando o status é atualizado
        const onStatusUpdate = (newStatus: EquipmentStatusType) => {
          if (isMountedRef.current) {
            console.log(`[useEquipmentStatusMonitoring] 📊 Status atualizado: ${newStatus}`);
            setStatus(newStatus);
          }
        };

        // Iniciar monitoramento
        const subs = await attachEquipmentStatusMonitors(
          device,
          onMessage,
          onStatusUpdate,
        );

        subscriptionsRef.current = subs;
        console.log('[useEquipmentStatusMonitoring] ✅ Monitoramento do status iniciado');

      } catch (error: any) {
        const errorMsg = error?.message || 'Erro desconhecido';
        console.error('[useEquipmentStatusMonitoring] ❌ Erro ao iniciar monitoramento:', errorMsg);
        setError(errorMsg);
        setIsMonitoring(false);
        setStatus(null);
      }
    };

    startMonitoring();

    // Cleanup: parar monitoramento quando desmontar
    return () => {
      isMountedRef.current = false;
      console.log('[useEquipmentStatusMonitoring] Parando monitoramento do status...');

      if (subscriptionsRef.current) {
        try {
          detachEquipmentStatusMonitors(subscriptionsRef.current, (msg) => {
            console.log(`[useEquipmentStatusMonitoring] ${msg}`);
          });
          subscriptionsRef.current = null;
        } catch (e) {
          console.warn('[useEquipmentStatusMonitoring] Erro ao parar monitoramento:', e);
        }
      }

      setIsMonitoring(false);
      setStatus(null);
    };
  }, [connectedDevice, getConnectedDevice]);

  return {
    status,
    isMonitoring,
    error,
  };
}
