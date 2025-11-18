// Tipos compartilhados para Bluetooth (BLE e Clássico)

export type BluetoothDeviceType = 'ble' | 'classic';

export interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number | null;
  type: BluetoothDeviceType;
  address?: string; // Para Bluetooth clássico
}

export interface BluetoothScanOptions {
  allowDuplicates?: boolean;
  scanMode?: 'lowPower' | 'balanced' | 'lowLatency' | 'opportunistic';
}

export interface BluetoothConnectionOptions {
  timeout?: number;
}

export interface BluetoothService {
  // Scan
  startScan(options?: BluetoothScanOptions): Promise<void>;
  stopScan(): void;
  isScanning(): boolean;

  // Connection
  connect(
    deviceId: string,
    options?: BluetoothConnectionOptions
  ): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectedDevice(): BluetoothDevice | null;

  // Events
  onDeviceFound(callback: (device: BluetoothDevice) => void): () => void; // Retorna função para remover listener
  onDeviceConnected(callback: (device: BluetoothDevice) => void): () => void;
  onDeviceDisconnected(callback: () => void): () => void;
  onScanError(callback: (error: Error) => void): () => void;

  // Cleanup
  destroy(): void;
}
