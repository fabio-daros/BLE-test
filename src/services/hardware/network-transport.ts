import { HardwareTransport, DataListener } from './transport';

export class NetworkTransport implements HardwareTransport {
  private listeners: Set<DataListener> = new Set();
  private socket: WebSocket | null = null;
  private _isConnected = false;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

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
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        this.socket = ws;
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          this._isConnected = true;
          resolve();
        };
        ws.onmessage = evt => {
          const data = evt.data as ArrayBuffer;
          const bytes = new Uint8Array(data);
          for (const l of this.listeners) l(bytes);
        };
        ws.onerror = err => {
          if (!this._isConnected) reject(err);
        };
        ws.onclose = () => {
          this._isConnected = false;
          this.socket = null;
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) this.socket.close();
    this._isConnected = false;
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(data);
  }
}
