export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  tag?: string;
  message: string;
  metadata?: object | null;
  ctx: {
    sessionId?: string;
    userId?: string;
    deviceId?: string;
  };
}

export interface LogsRepository {
  save(log: Omit<LogEntry, 'id'>): Promise<number>;
  findById(id: number): Promise<LogEntry | null>;
  query(opts?: {
    level?: LogLevel[];
    tag?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]>;
  clear(): Promise<void>;
  deleteOldLogs(beforeTimestamp: number): Promise<number>;
  getCount(): Promise<number>;
}
