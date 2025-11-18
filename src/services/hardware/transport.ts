export type DataListener = (data: Uint8Array) => void;

export interface HardwareTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  onData(listener: DataListener): void;
  offData(listener: DataListener): void;
  readonly isConnected: boolean;
}
