import { useEffect, useState, useCallback, useRef } from 'react';
import type { Device } from 'react-native-ble-plx';
import { useBluetooth } from '@/contexts/BluetoothContext';
import {
  attachTemperatureBlockMonitors,
  detachTemperatureBlockMonitors,
  type TemperatureBlockSubscriptions,
} from './temperatureBlockReader';
import { useEquipmentStatusMonitoring } from '../equipmentStatus/useEquipmentStatusMonitoring';
import { TEMPERATURE_BLOCK_SERVICE_UUID } from './temperatureBlockProtocol';
import { logger } from '@services/logging';

export interface UseTemperatureBlockMonitoringResult {
  temperature: number | null;
  isMonitoring: boolean;
  error: string | null;
}

/**
 * Hook customizado para monitorar a temperatura do bloco em tempo real via BLE.
 * Automaticamente obtém o Device conectado e inicia o monitoramento.
 * Para de buscar temperatura quando o equipment status é 'standby'.
 * 
 * @returns {UseTemperatureBlockMonitoringResult} Objeto com temperatura atual, estado de monitoramento e erro
 */
export function useTemperatureBlockMonitoring(): UseTemperatureBlockMonitoringResult {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monitorar equipment status para saber quando parar de buscar temperatura
  const { status: equipmentStatus } = useEquipmentStatusMonitoring();

  const {
    connectedDevice,
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  const subscriptionsRef = useRef<TemperatureBlockSubscriptions | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Obtém o Device conectado usando múltiplas estratégias de fallback.
   * Mesma lógica do useTemperatureBlockConfig para garantir compatibilidade.
   */
  const getConnectedDevice = useCallback(async (): Promise<Device | null> => {
    if (!connectedDevice || !bleManager || !bleManagerAvailable) {
      console.log('[useTemperatureBlockMonitoring] Nenhum dispositivo conectado');
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
          console.warn('[useTemperatureBlockMonitoring] Erro connectedDevices:', e);
        }

        // Fallback: devices([id])
        if (!device) {
          try {
            const byId = await bleManager.devices([deviceId]);
            if (byId && byId.length > 0 && byId[0]) {
              device = byId[0];
            }
          } catch (e) {
            console.warn('[useTemperatureBlockMonitoring] Erro devices:', e);
          }
        }

        // Último recurso: connectToDevice
        if (!device) {
          try {
            device = await bleManager.connectToDevice(deviceId, {
              autoConnect: true,
            });
          } catch (e: any) {
            console.warn('[useTemperatureBlockMonitoring] Erro connectToDevice:', e?.message);
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
          console.warn('[useTemperatureBlockMonitoring] Erro ao reconectar:', e?.message);
        }
      }

      if (!device) return null;

      const isConnected = await device.isConnected();
      return isConnected ? device : null;
    } catch (error: any) {
      console.error('[useTemperatureBlockMonitoring] Erro ao obter Device:', error?.message || error);
      return null;
    }
  }, [connectedDevice, bleManager, bleManagerAvailable, ensureBleManagerReady]);

  // Iniciar monitoramento quando o hook for montado
  useEffect(() => {
    isMountedRef.current = true;

    const startMonitoring = async () => {
      if (!connectedDevice) {
        console.log('[useTemperatureBlockMonitoring] Nenhum dispositivo conectado, não iniciando monitoramento');
        setIsMonitoring(false);
        setTemperature(null);
        setError(null);
        return;
      }

      // Se o equipment status é 'standby', não iniciar monitoramento de temperatura
      if (equipmentStatus === 'standby') {
        console.log('[useTemperatureBlockMonitoring] Equipamento em standby, não monitorando temperatura');
        setIsMonitoring(false);
        setTemperature(null);
        setError(null);
        
        // Parar monitoramento se estiver ativo
        if (subscriptionsRef.current) {
          try {
            detachTemperatureBlockMonitors(subscriptionsRef.current, (msg) => {
              console.log(`[useTemperatureBlockMonitoring] ${msg}`);
            });
            subscriptionsRef.current = null;
          } catch (e) {
            console.warn('[useTemperatureBlockMonitoring] Erro ao parar monitoramento:', e);
          }
        }
        return;
      }

      try {
        setIsMonitoring(true);
        setError(null);

        const device = await getConnectedDevice();
        if (!device) {
          throw new Error('Dispositivo não conectado');
        }

        console.log('[useTemperatureBlockMonitoring] Iniciando monitoramento da temperatura...');

        // Callback de log
        const onMessage = (msg: string) => {
          console.log(`[useTemperatureBlockMonitoring] ${msg}`);
          logger.info(msg, {}, 'bluetooth');
        };

        // Callback quando a temperatura é atualizada
        const onTemperatureUpdate = (temp: number) => {
          if (isMountedRef.current) {
            console.log(`[useTemperatureBlockMonitoring] 🌡️ Temperatura atualizada: ${temp}°C`);
            setTemperature(temp);
          }
        };

        // Iniciar monitoramento
        const subs = await attachTemperatureBlockMonitors(
          device,
          onMessage,
          onTemperatureUpdate, // Callback de atualização
        );

        subscriptionsRef.current = subs;
        console.log('[useTemperatureBlockMonitoring] ✅ Monitoramento iniciado');

      } catch (error: any) {
        const errorMsg = error?.message || 'Erro desconhecido';
        console.error('[useTemperatureBlockMonitoring] ❌ Erro ao iniciar monitoramento:', errorMsg);
        setError(errorMsg);
        setIsMonitoring(false);
        setTemperature(null); // Zerar temperatura em caso de erro
      }
    };

    startMonitoring();

    // Cleanup: parar monitoramento quando desmontar
    return () => {
      isMountedRef.current = false;
      console.log('[useTemperatureBlockMonitoring] Parando monitoramento...');

      if (subscriptionsRef.current) {
        try {
          detachTemperatureBlockMonitors(subscriptionsRef.current, (msg) => {
            console.log(`[useTemperatureBlockMonitoring] ${msg}`);
          });
          subscriptionsRef.current = null;
        } catch (e) {
          console.warn('[useTemperatureBlockMonitoring] Erro ao parar monitoramento:', e);
        }
      }

      setIsMonitoring(false);
      setTemperature(null); // Zerar temperatura quando o monitoramento para
    };
  }, [connectedDevice, getConnectedDevice, equipmentStatus]); // Adicionar equipmentStatus nas dependências

  return {
    temperature,
    isMonitoring,
    error,
  };
}
