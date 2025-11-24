import { useEffect, useRef } from 'react';
import type { Device } from 'react-native-ble-plx';
import { useBluetooth } from '@/contexts/BluetoothContext';
import {
  attachBatteryStatsMonitors,
  detachBatteryStatsMonitors,
  type BatteryStatsSubscriptions,
} from './batteryStatsReader';
import { BATTERY_STATS_SERVICE_UUID } from './batteryStatsProtocol';
import { logger } from '@services/logging';

/**
 * Hook customizado para monitorar o status da bateria em tempo real via BLE.
 * Automaticamente obtém o Device conectado e inicia o monitoramento.
 * Os logs são enviados apenas para o console/logcat, não aparecem na interface.
 * 
 * Este hook deve ser usado globalmente (ex: no App.tsx) para monitorar a bateria em todas as telas.
 */
export function useBatteryMonitoring(): void {
  const {
    connectedDevice,
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  const subscriptionsRef = useRef<BatteryStatsSubscriptions | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Obtém o Device conectado usando múltiplas estratégias de fallback.
   */
  const getConnectedDevice = async (): Promise<Device | null> => {
    if (!connectedDevice || !bleManager || !bleManagerAvailable) {
      console.log('[useBatteryMonitoring] Nenhum dispositivo conectado');
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
            BATTERY_STATS_SERVICE_UUID,
          ]);
          device = byService.find(d => d.id === deviceId) || null;
        } catch (e) {
          console.warn('[useBatteryMonitoring] Erro connectedDevices:', e);
        }

        // Fallback: devices([id])
        if (!device) {
          try {
            const byId = await bleManager.devices([deviceId]);
            if (byId && byId.length > 0 && byId[0]) {
              device = byId[0];
            }
          } catch (e) {
            console.warn('[useBatteryMonitoring] Erro devices:', e);
          }
        }

        // Último recurso: connectToDevice
        if (!device) {
          try {
            device = await bleManager.connectToDevice(deviceId, {
              autoConnect: true,
            });
          } catch (e: any) {
            console.warn('[useBatteryMonitoring] Erro connectToDevice:', e?.message);
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
          console.warn('[useBatteryMonitoring] Erro ao reconectar:', e?.message);
        }
      }

      if (!device) return null;

      const isConnected = await device.isConnected();
      return isConnected ? device : null;
    } catch (error: any) {
      console.error('[useBatteryMonitoring] Erro ao obter Device:', error?.message || error);
      return null;
    }
  };

  // Iniciar monitoramento quando o hook for montado
  useEffect(() => {
    isMountedRef.current = true;

    const startMonitoring = async () => {
      if (!connectedDevice) {
        console.log('[useBatteryMonitoring] Nenhum dispositivo conectado, não iniciando monitoramento');
        return;
      }

      try {
        const device = await getConnectedDevice();
        if (!device) {
          console.warn('[useBatteryMonitoring] Dispositivo não conectado');
          return;
        }

        console.log('[useBatteryMonitoring] Iniciando monitoramento da bateria...');

        // Callback de log - apenas para console/logcat
        const onMessage = (msg: string) => {
          console.log(`[useBatteryMonitoring] ${msg}`);
          logger.info(msg, {}, 'bluetooth');
        };

        // Callback quando a bateria é atualizada - apenas log
        const onBatteryUpdate = (percentage: number) => {
          if (isMountedRef.current) {
            console.log(`[useBatteryMonitoring] 🔋 Bateria atualizada: ${percentage}%`);
            logger.info(`Bateria: ${percentage}%`, { percentage }, 'bluetooth');
          }
        };

        // Iniciar monitoramento
        const subs = await attachBatteryStatsMonitors(
          device,
          onMessage,
          onBatteryUpdate,
        );

        subscriptionsRef.current = subs;
        console.log('[useBatteryMonitoring] ✅ Monitoramento da bateria iniciado');

      } catch (error: any) {
        const errorMsg = error?.message || 'Erro desconhecido';
        console.error('[useBatteryMonitoring] ❌ Erro ao iniciar monitoramento:', errorMsg);
      }
    };

    startMonitoring();

    // Cleanup: parar monitoramento quando desmontar
    return () => {
      isMountedRef.current = false;
      console.log('[useBatteryMonitoring] Parando monitoramento...');

      if (subscriptionsRef.current) {
        try {
          detachBatteryStatsMonitors(subscriptionsRef.current, (msg) => {
            console.log(`[useBatteryMonitoring] ${msg}`);
          });
          subscriptionsRef.current = null;
        } catch (e) {
          console.warn('[useBatteryMonitoring] Erro ao parar monitoramento:', e);
        }
      }
    };
  }, [connectedDevice]);
}

