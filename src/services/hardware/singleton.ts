import { HardwareService } from './service';
import { SimulatorHardwareTransport } from './simulator-transport';
import { NetworkTransport } from './network-transport';
import { ENV } from '../../../config/env';

let instance: HardwareService | null = null;

export function getHardwareServiceSingleton(): HardwareService {
  if (!instance) {
    const useExternal = (ENV as any).HARDWARE_SIM_EXTERNAL_WS_URL as
      | string
      | undefined;
    const transport = useExternal
      ? new NetworkTransport(useExternal)
      : new SimulatorHardwareTransport();
    instance = new HardwareService(transport);
    instance.connect();
  }
  return instance;
}
