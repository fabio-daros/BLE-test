import { HardwareStatusJSON } from '../hardware/codec';
import { ENV } from '../../../config/env';

export type SimulatorPreset =
  | 'standby'
  | 'heating'
  | 'analysis'
  | 'error'
  | 'pretest_start'
  | 'pretest_progress'
  | 'pretest_complete'
  | 'pretest_failure'
  | 'bluetooth_connect'
  | 'bluetooth_disconnect'
  | 'test_cinomose'
  | 'test_ibv_geral'
  | 'test_ibv_especifico';

export type SimulatorControl = 'start' | 'stop' | 'preset' | 'update';

export interface SimulatorResponse {
  ok: boolean;
  preset?: string;
  error?: string;
}

export interface SimulatorStatus {
  connected: boolean;
  status: HardwareStatusJSON | null;
  isRunning: boolean;
  bluetoothConnected: boolean;
  logs: string[];
}

export class SimulatorService {
  private baseUrl: string;
  private wsUrl: string;
  private websocket: WebSocket | null = null;
  private statusListeners: Set<(status: SimulatorStatus) => void> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentStatus: SimulatorStatus = {
    connected: false,
    status: null,
    isRunning: false,
    bluetoothConnected: false,
    logs: [],
  };

  constructor(baseUrl: string = 'http://localhost:8081') {
    this.baseUrl = baseUrl;
    this.wsUrl = baseUrl.replace('http', 'ws') + '/ws';

    // Não conectar automaticamente - aguardar chamada manual
    console.log('SimulatorService inicializado:', {
      baseUrl,
      wsUrl: this.wsUrl,
    });
  }

  async connect(): Promise<void> {
    try {
      // Fechar conexão existente se houver
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      this.addLogInternal(`🔄 Tentando conectar ao simulador...`);
      this.addLogInternal(`📍 URL: ${this.wsUrl}`);

      // Verificar se o simulador está rodando primeiro
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (!response.ok) {
          throw new Error(`Health check falhou: ${response.status}`);
        }
        this.addLogInternal('✅ Simulador está rodando');
      } catch (error) {
        this.addLogInternal(`❌ Simulador não está rodando: ${error}`);
        throw error;
      }

      // Conectar WebSocket
      this.websocket = new WebSocket(this.wsUrl);
      this.websocket.binaryType = 'arraybuffer';

      this.websocket.onopen = () => {
        this.currentStatus.connected = true;
        this.addLogInternal('✅ WebSocket conectado ao simulador');
        this.startPolling();
        this.notifyListeners();
      };

      this.websocket.onclose = event => {
        this.currentStatus.connected = false;
        this.addLogInternal(
          `❌ WebSocket desconectado (código: ${event.code}, motivo: ${event.reason || 'N/A'})`
        );

        // Códigos de erro comuns:
        if (event.code === 1006) {
          this.addLogInternal(
            '💡 Erro 1006: Conexão fechada inesperadamente. Verifique se o simulador está rodando.'
          );
        } else if (event.code === 1000) {
          this.addLogInternal('💡 Código 1000: Conexão fechada normalmente.');
        }

        this.notifyListeners();

        // Tentar reconectar após 5 segundos
        setTimeout(() => {
          if (!this.currentStatus.connected) {
            this.addLogInternal('🔄 Tentando reconectar automaticamente...');
            this.connect().catch(() => {});
          }
        }, 5000);
      };

      this.websocket.onmessage = event => {
        try {
          const bytes = new Uint8Array(event.data as ArrayBuffer);
          const newStatus = this.parseSimulatorFrame(bytes);

          // Log detalhado para debug (apenas a cada 10 mensagens para não spam)
          if (newStatus && Math.random() < 0.1) {
            this.addLogInternal(
              `📊 WebSocket - Temp: ${newStatus.blockTemperatureC}°C | Tempo: ${newStatus.analysisElapsed.hours}:${newStatus.analysisElapsed.minutes} | Status: ${newStatus.equipmentStatus}`
            );
          }

          this.currentStatus.status = newStatus;
          this.notifyListeners();
        } catch (error) {
          this.addLogInternal(`❌ Erro ao processar dados: ${error}`);
        }
      };

      this.websocket.onerror = error => {
        this.addLogInternal(`❌ Erro WebSocket: ${error}`);
        this.currentStatus.connected = false;
        this.notifyListeners();
      };
    } catch (error) {
      this.addLogInternal(`❌ Erro ao conectar: ${error}`);
      this.currentStatus.connected = false;
      this.notifyListeners();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.currentStatus.connected = false;
    this.notifyListeners();
  }

  private startPolling(): void {
    this.stopPolling(); // Parar polling anterior se existir
    this.pollingInterval = setInterval(async () => {
      if (this.currentStatus.connected) {
        try {
          const response = await fetch(`${this.baseUrl}/control/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (response.ok) {
            const data = await response.json();
            // O servidor retorna { ok: true, ...status }, então usamos data diretamente
            if (data.ok) {
              // Remover 'ok' e usar o resto como status
              const { ok, ...status } = data;

              // Sempre atualizar para garantir que tempo decorrido seja atualizado
              console.log('🔄 Polling - Status atualizado:', {
                temperature: status.blockTemperatureC,
                elapsedTime: `${status.analysisElapsed?.hours}:${status.analysisElapsed?.minutes}`,
                equipmentStatus: status.equipmentStatus,
              });
              this.currentStatus.status = status;
              this.notifyListeners();
            }
          }
        } catch (error) {
          // Silenciar erros de polling para não spam nos logs
        }
      }
    }, 1000); // Polling a cada 1 segundo
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async sendControl(
    control: SimulatorControl,
    data?: any
  ): Promise<SimulatorResponse> {
    try {
      const url = `${this.baseUrl}/control/${control}`;
      this.addLogInternal(`🔄 Enviando comando: ${control} para ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        ...(data && { body: JSON.stringify(data) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.preset) {
        this.addLogInternal(`✅ Preset aplicado: ${result.preset}`);
      } else {
        this.addLogInternal(`✅ Comando ${control} executado com sucesso`);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addLogInternal(
        `❌ Erro na requisição (SimulatorService): ${errorMessage}`
      );
      return { ok: false, error: errorMessage };
    }
  }

  async startSimulator(): Promise<SimulatorResponse> {
    const result = await this.sendControl('start');
    if (result.ok) {
      this.currentStatus.isRunning = true;
      this.addLogInternal('🔥 Simulador iniciado');
      this.notifyListeners();
    }
    return result;
  }

  async stopSimulator(): Promise<SimulatorResponse> {
    const result = await this.sendControl('stop');
    if (result.ok) {
      this.currentStatus.isRunning = false;
      this.addLogInternal('❄️ Simulador parado - Iniciando resfriamento');
      this.addLogInternal(
        '🔄 Tempos zerados - Temperatura descendo gradualmente'
      );
      this.notifyListeners();
    }
    return result;
  }

  async setPreset(preset: SimulatorPreset): Promise<SimulatorResponse> {
    const result = await this.sendControl('preset', { preset });
    if (result.ok) {
      this.addLogInternal(`Preset aplicado: ${preset}`);

      // Logs específicos para cada tipo de teste
      switch (preset) {
        case 'test_cinomose':
          this.addLogInternal(
            '🧪 Iniciando Teste Cinomose - Temperatura alvo: 65°C'
          );
          break;
        case 'test_ibv_geral':
          this.addLogInternal(
            '🔬 Iniciando Teste IBV Geral - Temperatura alvo: 80°C'
          );
          break;
        case 'test_ibv_especifico':
          this.addLogInternal(
            '🧬 Iniciando Teste IBV Específico - Temperatura alvo: 90°C'
          );
          break;
        case 'heating':
          this.addLogInternal(
            '🔥 Iniciando Aquecimento Geral - Temperatura alvo: 100°C'
          );
          break;
      }
    }
    return result;
  }

  async toggleBluetooth(): Promise<SimulatorResponse> {
    const preset = this.currentStatus.bluetoothConnected
      ? 'bluetooth_disconnect'
      : 'bluetooth_connect';
    this.addLogInternal(
      `🔄 ${this.currentStatus.bluetoothConnected ? 'Desconectando' : 'Conectando'} Bluetooth...`
    );

    const result = await this.setPreset(preset);

    if (result.ok) {
      this.currentStatus.bluetoothConnected =
        !this.currentStatus.bluetoothConnected;
      this.addLogInternal(
        this.currentStatus.bluetoothConnected
          ? '📱 Bluetooth conectado'
          : '📱 Bluetooth desconectado'
      );
      this.notifyListeners();
    } else {
      this.addLogInternal(
        `❌ Falha ao ${this.currentStatus.bluetoothConnected ? 'desconectar' : 'conectar'} Bluetooth`
      );
    }

    return result;
  }

  onStatus(listener: (status: SimulatorStatus) => void): void {
    this.statusListeners.add(listener);
    // Notificar com status atual
    listener(this.currentStatus);
  }

  offStatus(listener: (status: SimulatorStatus) => void): void {
    this.statusListeners.delete(listener);
  }

  get currentSimulatorStatus(): SimulatorStatus {
    return this.currentStatus;
  }

  addLog(message: string): void {
    this.addLogInternal(message);
  }

  private addLogInternal(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.currentStatus.logs.unshift(`[${timestamp}] ${message}`);
    // Manter apenas os últimos 50 logs
    this.currentStatus.logs = this.currentStatus.logs.slice(0, 50);
  }

  private notifyListeners(): void {
    for (const listener of this.statusListeners) {
      listener(this.currentStatus);
    }
  }

  private parseSimulatorFrame(bytes: Uint8Array): HardwareStatusJSON | null {
    // Usar o codec real do hardware
    if (bytes.length < 12) return null;

    const readUint16 = (off: number) =>
      ((bytes[off] ?? 0) << 8) | (bytes[off + 1] ?? 0);
    const batteryPercent = Math.max(0, Math.min(100, readUint16(0)));
    const tempByte = bytes[2] ?? 0;
    const isPos = (tempByte & 0x80) !== 0 ? 1 : 0;
    const magnitude = tempByte & 0x7f;
    const blockTemperatureC = isPos === 1 ? magnitude : -magnitude;
    const blockHeatingTime = { hours: bytes[4] ?? 0, minutes: bytes[5] ?? 0 };
    const equipmentStatus: 'analysis' | 'standby' =
      ((bytes[6] ?? 0) & 0x01) === 1 ? 'analysis' : 'standby';
    const analysisElapsed = { hours: bytes[7] ?? 0, minutes: bytes[8] ?? 0 };

    // Parse pre-test status (byte 9)
    const preTestStatusByte = bytes[9] ?? 0;
    let preTestStatus: 'not_started' | 'in_progress' | 'completed' =
      'not_started';
    if (preTestStatusByte & 0x02) preTestStatus = 'completed';
    else if (preTestStatusByte & 0x01) preTestStatus = 'in_progress';

    // Parse pre-test failures (bytes 10-11)
    const failureByte1 = bytes[10] ?? 0;
    const failureByte2 = bytes[11] ?? 0;
    const preTestFailures = {
      batteryLow: (failureByte1 & 0x01) !== 0,
      heatingFailure: (failureByte1 & 0x02) !== 0,
      lidOpen: (failureByte1 & 0x04) !== 0,
      wellFailure: (failureByte1 & 0x08) !== 0,
      failedWells: failureByte2,
    };

    // Parse test type (byte 12) - se existir
    let testType: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'none' = 'none';
    if (bytes.length > 12) {
      const testTypeByte = bytes[12] ?? 0;
      switch (testTypeByte) {
        case 1:
          testType = 'cinomose';
          break;
        case 2:
          testType = 'ibv_geral';
          break;
        case 3:
          testType = 'ibv_especifico';
          break;
        default:
          testType = 'none';
      }
    }

    return {
      batteryPercent,
      blockTemperatureC,
      blockHeatingTime,
      equipmentStatus,
      analysisElapsed,
      preTestStatus,
      preTestFailures,
      testType,
    };
  }
}

// Singleton instance
let simulatorServiceInstance: SimulatorService | null = null;

export function getSimulatorService(): SimulatorService {
  if (!simulatorServiceInstance) {
    // Usar o URL externo se configurado, caso contrário usar localhost
    const baseUrl = ENV.HARDWARE_SIM_EXTERNAL_WS_URL || 'http://localhost:8081';
    simulatorServiceInstance = new SimulatorService(baseUrl);
  }
  return simulatorServiceInstance;
}
