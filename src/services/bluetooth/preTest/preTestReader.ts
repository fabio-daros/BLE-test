import type { Device } from 'react-native-ble-plx';

export interface PreTestSubscriptions {
  stop: () => void;
}

export async function attachPreTestMonitors(
  device: Device,
  onMessage: (msg: string) => void,
): Promise<PreTestSubscriptions> {
  onMessage(
    'Monitores de pré-teste desativados temporariamente ' +
      '(bug de SafePromise/monitorCharacteristic na lib BLE).',
  );

  // Aqui não chamamos NENHUMA função de monitor da lib.
  // Só devolvemos um "subscription" fake para manter a API igual.
  return {
    stop: () => {
      onMessage('Monitores de pré-teste já estavam desativados.');
    },
  };
}

export function detachPreTestMonitors(
  subs: PreTestSubscriptions,
  onMessage: (msg: string) => void,
) {
  try {
    subs.stop();
  } catch {
    // ignore
  }
  onMessage('Monitores de pré-teste finalizados.');
}