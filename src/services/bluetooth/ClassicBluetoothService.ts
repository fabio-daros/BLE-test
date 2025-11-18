// Serviço para Bluetooth Clássico usando react-native-bluetooth-classic
// Importação opcional - se a biblioteca não estiver disponível, o serviço não funcionará
let RNBluetoothClassic: any = null;
let RNBluetoothClassicDevice: any = null;

try {
  const bluetoothClassicModule = require('react-native-bluetooth-classic');
  RNBluetoothClassic = bluetoothClassicModule.default || bluetoothClassicModule;
  RNBluetoothClassicDevice = bluetoothClassicModule.BluetoothDevice;
} catch (error) {
  console.warn('react-native-bluetooth-classic não disponível:', error);
}
import type {
  BluetoothDevice,
  BluetoothService,
  BluetoothScanOptions,
  BluetoothConnectionOptions,
} from './types';

export class ClassicBluetoothService implements BluetoothService {
  private isScanningRef = false;
  private connectedDevice: BluetoothDevice | null = null;
  private deviceFoundCallbacks: Array<(device: BluetoothDevice) => void> = [];
  private deviceConnectedCallbacks: Array<(device: BluetoothDevice) => void> =
    [];
  private deviceDisconnectedCallbacks: Array<() => void> = [];
  private scanErrorCallbacks: Array<(error: Error) => void> = [];
  private scanSubscription: any = null;

  async startScan(options?: BluetoothScanOptions): Promise<void> {
    if (!RNBluetoothClassic) {
      throw new Error(
        'react-native-bluetooth-classic não está disponível. A biblioteca pode não estar instalada ou há problemas com o build.'
      );
    }

    if (this.isScanningRef) {
      return;
    }

    try {
      // Verificar se Bluetooth está habilitado
      const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!isEnabled) {
        throw new Error('Bluetooth não está habilitado');
      }

      this.isScanningRef = true;

      // Buscar dispositivos pareados primeiro
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      pairedDevices.forEach(device => {
        this.handleDeviceFound(this.mapToBluetoothDevice(device));
      });

      // Iniciar descoberta de novos dispositivos
      this.scanSubscription = RNBluetoothClassic.onDeviceDiscovered(
        (device: RNBluetoothClassicDevice) => {
          this.handleDeviceFound(this.mapToBluetoothDevice(device));
        }
      );

      await RNBluetoothClassic.startDiscovery();
    } catch (error) {
      this.isScanningRef = false;
      this.handleScanError(error as Error);
      throw error;
    }
  }

  stopScan(): void {
    if (!this.isScanningRef) {
      return;
    }

    try {
      RNBluetoothClassic.cancelDiscovery();
      if (this.scanSubscription) {
        this.scanSubscription.remove();
        this.scanSubscription = null;
      }
      this.isScanningRef = false;
    } catch (error) {
      console.error('Erro ao parar scan Bluetooth clássico:', error);
    }
  }

  isScanning(): boolean {
    return this.isScanningRef;
  }

  async connect(
    deviceId: string,
    options?: BluetoothConnectionOptions
  ): Promise<void> {
    try {
      // Buscar dispositivo pareado ou descobrir
      let device: RNBluetoothClassicDevice | null = null;

      // Tentar encontrar em dispositivos pareados
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      device = pairedDevices.find(d => d.address === deviceId) || null;

      // Se não encontrou, tentar descobrir
      if (!device) {
        // Nota: Em produção, pode ser necessário parear primeiro
        throw new Error(
          'Dispositivo não encontrado. Certifique-se de que está pareado nas configurações do Android.'
        );
      }

      // Conectar
      const connection = await device.connect();
      if (connection) {
        this.connectedDevice = this.mapToBluetoothDevice(device);
        this.handleDeviceConnected(this.connectedDevice);
      } else {
        throw new Error('Falha ao conectar ao dispositivo');
      }
    } catch (error) {
      throw new Error(`Erro ao conectar: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }

    try {
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      const device = pairedDevices.find(
        d => d.address === this.connectedDevice!.id
      );

      if (device) {
        await device.disconnect();
      }

      this.connectedDevice = null;
      this.handleDeviceDisconnected();
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      this.connectedDevice = null;
      this.handleDeviceDisconnected();
    }
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }

  onDeviceFound(callback: (device: BluetoothDevice) => void): () => void {
    this.deviceFoundCallbacks.push(callback);
    return () => {
      const index = this.deviceFoundCallbacks.indexOf(callback);
      if (index > -1) {
        this.deviceFoundCallbacks.splice(index, 1);
      }
    };
  }

  onDeviceConnected(callback: (device: BluetoothDevice) => void): () => void {
    this.deviceConnectedCallbacks.push(callback);
    return () => {
      const index = this.deviceConnectedCallbacks.indexOf(callback);
      if (index > -1) {
        this.deviceConnectedCallbacks.splice(index, 1);
      }
    };
  }

  onDeviceDisconnected(callback: () => void): () => void {
    this.deviceDisconnectedCallbacks.push(callback);
    return () => {
      const index = this.deviceDisconnectedCallbacks.indexOf(callback);
      if (index > -1) {
        this.deviceDisconnectedCallbacks.splice(index, 1);
      }
    };
  }

  onScanError(callback: (error: Error) => void): () => void {
    this.scanErrorCallbacks.push(callback);
    return () => {
      const index = this.scanErrorCallbacks.indexOf(callback);
      if (index > -1) {
        this.scanErrorCallbacks.splice(index, 1);
      }
    };
  }

  destroy(): void {
    this.stopScan();
    this.disconnect();
    this.deviceFoundCallbacks = [];
    this.deviceConnectedCallbacks = [];
    this.deviceDisconnectedCallbacks = [];
    this.scanErrorCallbacks = [];
  }

  // Helpers
  private mapToBluetoothDevice(
    device: RNBluetoothClassicDevice
  ): BluetoothDevice {
    return {
      id: device.address,
      name: device.name || 'Dispositivo sem nome',
      type: 'classic',
      address: device.address,
    };
  }

  private handleDeviceFound(device: BluetoothDevice): void {
    this.deviceFoundCallbacks.forEach(callback => {
      try {
        callback(device);
      } catch (error) {
        console.error('Erro no callback de dispositivo encontrado:', error);
      }
    });
  }

  private handleDeviceConnected(device: BluetoothDevice): void {
    this.deviceConnectedCallbacks.forEach(callback => {
      try {
        callback(device);
      } catch (error) {
        console.error('Erro no callback de dispositivo conectado:', error);
      }
    });
  }

  private handleDeviceDisconnected(): void {
    this.deviceDisconnectedCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Erro no callback de dispositivo desconectado:', error);
      }
    });
  }

  private handleScanError(error: Error): void {
    this.scanErrorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Erro no callback de erro de scan:', err);
      }
    });
  }
}
