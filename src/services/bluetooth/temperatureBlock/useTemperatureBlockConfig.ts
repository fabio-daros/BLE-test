import { useCallback, useState } from 'react';
import type { Device } from 'react-native-ble-plx';
import { useBluetooth } from '@/contexts/BluetoothContext';
import { writeTemperatureBlockConfig } from './temperatureBlockConfigWriter';
import { TEMPERATURE_BLOCK_SERVICE_UUID } from './temperatureBlockProtocol';
import { logger } from '@services/logging';
import { useNavigationLogger } from '@services/logging';
import type { TestProfile } from '@/types/test-profile';

export interface UseTemperatureBlockConfigResult {
  sendProfileConfig: (profile: TestProfile) => Promise<boolean>;
  isSending: boolean;
  error: string | null;
}

/**
 * Hook customizado para enviar configuração de temperatura do bloco ao hardware via BLE.
 * Encapsula a lógica de recuperação do Device conectado e envio da configuração.
 * 
 * @returns {UseTemperatureBlockConfigResult} Objeto com função de envio, estado de loading e erro
 */
export function useTemperatureBlockConfig(): UseTemperatureBlockConfigResult {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connectedDevice,
    bleManager,
    bleManagerAvailable,
    ensureBleManagerReady,
  } = useBluetooth();

  const { logUserAction } = useNavigationLogger({
    screenName: 'useTemperatureBlockConfig',
    additionalContext: {},
  });

  /**
   * Obtém o Device BLE conectado usando múltiplas estratégias de fallback.
   * Mesma lógica utilizada na BluetoothConnectionScreen para garantir compatibilidade.
   */
  const getConnectedDevice = useCallback(async (): Promise<Device | null> => {
    if (!connectedDevice || !bleManager || !bleManagerAvailable) {
      console.log('[useTemperatureBlockConfig] Nenhum dispositivo conectado ou manager não disponível');
      return null;
    }

    try {
      const managerReady = await ensureBleManagerReady();
      if (!managerReady || !bleManager) {
        console.log('[useTemperatureBlockConfig] Manager não está pronto');
        return null;
      }

      const deviceId = connectedDevice.id;
      
      // Verificar se está conectado
      const alreadyConnected = await bleManager.isDeviceConnected(deviceId);
      console.log(`[useTemperatureBlockConfig] isDeviceConnected(${deviceId}) = ${alreadyConnected}`);

      let device: Device | null = null;

      if (alreadyConnected) {
        // 1) Tentar obter via connectedDevices
        try {
          const byService = await bleManager.connectedDevices([
            TEMPERATURE_BLOCK_SERVICE_UUID,
          ]);
          const foundById = byService.find(d => d.id === deviceId);
          if (foundById) {
            device = foundById;
            console.log('[useTemperatureBlockConfig] ✅ Device encontrado via connectedDevices');
          }
        } catch (e) {
          console.warn('[useTemperatureBlockConfig] Erro ao buscar connectedDevices:', e);
        }

        // 2) Fallback: tentar via devices([id])
        if (!device) {
          try {
            const byId = await bleManager.devices([deviceId]);
            if (byId && byId.length > 0 && byId[0]) {
              device = byId[0];
              console.log('[useTemperatureBlockConfig] ✅ Device encontrado via devices([id])');
            }
          } catch (e) {
            console.warn('[useTemperatureBlockConfig] Erro ao buscar devices([id]):', e);
          }
        }

        // 3) Último recurso: tentar connectToDevice mesmo estando conectado
        if (!device) {
          try {
            device = await bleManager.connectToDevice(deviceId, {
              autoConnect: true,
            });
            console.log('[useTemperatureBlockConfig] ✅ Device encontrado via connectToDevice (já conectado)');
          } catch (e: any) {
            console.warn('[useTemperatureBlockConfig] Erro ao connectToDevice:', e?.message);
          }
        }
      } else {
        // Se não está conectado, tentar reconectar
        try {
          device = await bleManager.connectToDevice(deviceId, {
            autoConnect: true,
          });
          await device.discoverAllServicesAndCharacteristics();
          console.log('[useTemperatureBlockConfig] ✅ Device reconectado');
        } catch (e: any) {
          console.warn('[useTemperatureBlockConfig] Erro ao reconectar:', e?.message);
        }
      }

      if (!device) {
        console.log('[useTemperatureBlockConfig] ❌ Não foi possível obter Device');
        return null;
      }

      // Verificar se realmente está conectado
      const isConnected = await device.isConnected();
      if (!isConnected) {
        console.log('[useTemperatureBlockConfig] ⚠️ Device não está conectado');
        return null;
      }

      console.log('[useTemperatureBlockConfig] ✅✅✅ Device conectado e pronto!');
      return device;
    } catch (error: any) {
      console.error('[useTemperatureBlockConfig] ❌ Erro ao obter Device:', error?.message || error);
      return null;
    }
  }, [connectedDevice, bleManager, bleManagerAvailable, ensureBleManagerReady]);

  /**
   * Envia a configuração do perfil de teste ao hardware via BLE.
   * 
   * @param profile - Perfil de teste contendo temperatura e tempo de reação
   * @returns Promise<boolean> - true se enviado com sucesso, false caso contrário
   */
  const sendProfileConfig = useCallback(
    async (profile: TestProfile): Promise<boolean> => {
      setIsSending(true);
      setError(null);

      try {
        console.log('[useTemperatureBlockConfig] ========== INICIANDO ENVIO DE CONFIGURAÇÃO ==========');
        console.log('[useTemperatureBlockConfig] Perfil:', profile.name);
        console.log('[useTemperatureBlockConfig] Temperatura:', profile.targetTemperature, '°C');
        console.log('[useTemperatureBlockConfig] Tempo:', profile.totalTime.minutes, 'min');
        
        const device = await getConnectedDevice();
        if (!device) {
          const errorMsg = 'Dispositivo não conectado';
          console.log(`[useTemperatureBlockConfig] ❌ ${errorMsg}`);
          setError(errorMsg);
          return false;
        }

        // Usar apenas minutos (hardware só usa minutos)
        const reactionTimeMinutes = profile.totalTime.minutes;

        console.log('[useTemperatureBlockConfig] Parâmetros finais:', {
          temperature: profile.targetTemperature,
          reactionTime: reactionTimeMinutes,
          testType: profile.hardwareTestType,
        });

        // Callback de log - mesma estrutura da BluetoothConnectionScreen
        const onMessage = (msg: string) => {
          console.log(`[useTemperatureBlockConfig] ${msg}`);
          logger.info(msg, {}, 'bluetooth');
        };

        console.log('[useTemperatureBlockConfig] Chamando writeTemperatureBlockConfig...');
        
        // Enviar configuração ao hardware
        const result = await writeTemperatureBlockConfig(device, onMessage, {
          temperatureCelsius: profile.targetTemperature,
          reactionTimeMinutes,
          testType: profile.hardwareTestType,
        });

        if (result) {
          console.log('[useTemperatureBlockConfig] ✅✅✅ CONFIGURAÇÃO ENVIADA COM SUCESSO! ✅✅✅');
          console.log('[useTemperatureBlockConfig] Resultado:', {
            temperature: result.temperature,
            reactionTime: result.reactionTimeMinutes,
            hex: result.hex,
            bytes: result.bytes,
          });
          
          // Log da ação do usuário
          logUserAction('temperature_block_config_sent', {
            profileId: profile.id,
            profileName: profile.name,
            temperature: result.temperature,
            reactionTime: result.reactionTimeMinutes,
            testType: result.type,
          });

          return true;
        } else {
          const errorMsg = 'Configuração não pôde ser enviada (result é null)';
          console.warn(`[useTemperatureBlockConfig] ⚠️ ${errorMsg}`);
          setError(errorMsg);
          return false;
        }
      } catch (error: any) {
        const errorMsg = error?.message || 'Erro desconhecido';
        console.error('[useTemperatureBlockConfig] ❌ ERRO ao enviar configuração:', error);
        console.error('[useTemperatureBlockConfig] Mensagem:', errorMsg);
        console.error('[useTemperatureBlockConfig] Stack:', error?.stack);
        
        setError(errorMsg);
        
        // Log do erro
        logUserAction('temperature_block_config_error', {
          profileId: profile.id,
          error: errorMsg,
        });
        
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [getConnectedDevice, logUserAction]
  );

  return {
    sendProfileConfig,
    isSending,
    error,
  };
}
