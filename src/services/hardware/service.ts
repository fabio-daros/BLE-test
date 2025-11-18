import {
  parseHardwareFrame,
  serializeHardwareFrame,
  HardwareStatusJSON,
} from './codec';
import { HardwareTransport, DataListener } from './transport';

type HardwareStatusListener = (status: HardwareStatusJSON) => void;

export class HardwareService {
  private transport: HardwareTransport;
  private statusListeners: Set<HardwareStatusListener> = new Set();
  private lastStatus: HardwareStatusJSON | null = null;
  private boundOnData?: DataListener;

  constructor(transport: HardwareTransport) {
    this.transport = transport;
  }

  get isConnected(): boolean {
    return this.transport.isConnected;
  }

  get currentStatus(): HardwareStatusJSON | null {
    return this.lastStatus;
  }

  async connect(): Promise<void> {
    await this.transport.connect();
    this.boundOnData = bytes => this.handleIncoming(bytes);
    this.transport.onData(this.boundOnData);
  }

  async disconnect(): Promise<void> {
    if (this.boundOnData) {
      this.transport.offData(this.boundOnData);
      this.boundOnData = undefined as any;
    }
    await this.transport.disconnect();
  }

  onStatus(listener: HardwareStatusListener): void {
    this.statusListeners.add(listener);
    if (this.lastStatus) listener(this.lastStatus);
  }

  offStatus(listener: HardwareStatusListener): void {
    this.statusListeners.delete(listener);
  }

  async sendJson(json: HardwareStatusJSON): Promise<void> {
    const frame = serializeHardwareFrame(json);
    await this.transport.send(frame);
  }

  private handleIncoming(bytes: Uint8Array): void {
    try {
      const status = parseHardwareFrame(bytes);
      this.lastStatus = status;
      for (const l of this.statusListeners) l(status);
    } catch (err) {
      // Em casos reais, lidar com framing parcial e CRC.
    }
  }
}
