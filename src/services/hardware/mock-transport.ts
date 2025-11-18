import { HardwareTransport, DataListener } from './transport';

export class MockHardwareTransport implements HardwareTransport {
  private listeners: Set<DataListener> = new Set();
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
  }

  onData(listener: DataListener): void {
    this.listeners.add(listener);
  }

  offData(listener: DataListener): void {
    this.listeners.delete(listener);
  }

  async send(data: Uint8Array): Promise<void> {
    // Mock: ecoa de volta os dados enviados, simulando resposta do hardware
    // Em cenários reais, haveria framing e protocolos específicos.
    if (!this._isConnected) throw new Error('Not connected');
    // Simula um pequeno atraso
    await new Promise(r => setTimeout(r, 5));
    this.emit(data);
  }

  emit(data: Uint8Array) {
    for (const l of this.listeners) l(data);
  }
}
