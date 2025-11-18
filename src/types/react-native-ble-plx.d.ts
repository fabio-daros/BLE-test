declare module 'react-native-ble-plx' {
  export type State =
    | 'Unknown'
    | 'Resetting'
    | 'Unsupported'
    | 'Unauthorized'
    | 'PoweredOff'
    | 'PoweredOn';

  export interface Subscription {
    remove(): void;
  }

  export interface BleError extends Error {
    errorCode?: string | number;
  }

  export interface ConnectionOptions {
    timeout?: number;
  }

  export interface Device {
    id: string;
    name: string | null;
    localName?: string | null;
    rssi: number | null;
    connect(): Promise<Device>;
    cancelConnection(): Promise<void>;
    isConnected(): Promise<boolean>;
    discoverAllServicesAndCharacteristics(): Promise<Device>;
  }

  export class BleManager {
    constructor();
    destroy(): void;
    startDeviceScan(
      uuids: string[] | null,
      options: Record<string, unknown> | null,
      listener: (error: BleError | null, device: Device | null) => void
    ): void;
    stopDeviceScan(): void;
    connectToDevice(id: string, options?: ConnectionOptions): Promise<Device>;
    cancelDeviceConnection(id: string): Promise<void>;
    onStateChange(
      listener: (state: State) => void,
      emitCurrentState?: boolean
    ): Subscription;
  }
}
