import { HardwareTransport, DataListener } from './transport';
import { serializeHardwareFrame } from './codec';

export class SimulatorHardwareTransport implements HardwareTransport {
  private listeners: Set<DataListener> = new Set();
  private _isConnected = false;
  private timer: any = null;
  private temp: number = 0;
  private minute: number = 0;
  private hour: number = 0;

  get isConnected(): boolean {
    return this._isConnected;
  }

  onData(listener: DataListener): void {
    this.listeners.add(listener);
  }

  offData(listener: DataListener): void {
    this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this._isConnected) return;
    this._isConnected = true;
    this.startEmitting();
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async send(_data: Uint8Array): Promise<void> {
    // No-op no simulador
  }

  private startEmitting() {
    // Emite a cada 500ms simulando temperatura do bloco de 0 a 100 °C
    this.timer = setInterval(() => {
      if (!this._isConnected) return;
      const frame = serializeHardwareFrame({
        batteryPercent: 85,
        blockTemperatureC: this.temp,
        blockHeatingTime: {
          hours: 0,
          minutes: Math.min(59, Math.floor(this.temp / 2)),
        },
        equipmentStatus: this.temp % 20 < 15 ? 'analysis' : 'standby',
        analysisElapsed: { hours: this.hour, minutes: this.minute },
        preTestStatus: 'not_started',
        preTestFailures: {
          batteryLow: false,
          heatingFailure: false,
          lidOpen: false,
          wellFailure: false,
          failedWells: 0,
        },
        testType: 'none',
      });
      this.emit(frame);

      this.temp = (this.temp + 5) % 101; // 0..100
      this.minute = (this.minute + 1) % 60;
      if (this.minute === 0) this.hour = (this.hour + 1) % 24;
    }, 500);
  }

  private emit(data: Uint8Array) {
    for (const l of this.listeners) l(data);
  }
}
