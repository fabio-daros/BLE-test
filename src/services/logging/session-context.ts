import { Platform } from 'react-native';

export interface SessionContext {
  sessionId: string;
  deviceId: string;
  platform: string;
  appVersion: string;
  timestamp: number;
  userId?: string;
}

class SessionContextManager {
  private sessionContext: SessionContext;

  constructor() {
    this.sessionContext = this.createSessionContext();
  }

  private createSessionContext(): SessionContext {
    const sessionId = this.generateSessionId();
    const deviceId = this.generateDeviceId();

    return {
      sessionId,
      deviceId,
      platform: Platform.OS,
      appVersion: '1.0.0',
      timestamp: Date.now(),
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceId(): string {
    // Gera um ID único baseado na plataforma e timestamp
    return `device_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionContext(): SessionContext {
    return { ...this.sessionContext };
  }

  getSessionId(): string {
    return this.sessionContext.sessionId;
  }

  getDeviceId(): string {
    return this.sessionContext.deviceId;
  }

  // Atualiza o contexto com informações adicionais
  updateContext(additionalContext: Partial<SessionContext>): void {
    this.sessionContext = {
      ...this.sessionContext,
      ...additionalContext,
    };
  }

  // Gera um novo contexto de sessão (útil para logout/login)
  refreshSession(): void {
    this.sessionContext = this.createSessionContext();
  }
}

export const sessionContextManager = new SessionContextManager();
