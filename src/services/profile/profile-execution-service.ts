import { HardwareService } from './service';
import { TestProfile, TestProfileSnapshot } from '@types/test-profile';
import { memoryTestProfileRepository } from '@data/storage';
import { useNavigationLogger } from '@services/logging';

export interface ProfileExecutionService {
  executeProfile(profileId: number, userId: string): Promise<void>;
  getActiveProfile(testType: string): Promise<TestProfile | null>;
  validateProfileForExecution(
    profile: TestProfile
  ): Promise<{ isValid: boolean; errors: string[] }>;
}

class ProfileExecutionServiceImpl implements ProfileExecutionService {
  constructor(private hardwareService: HardwareService) {}

  async executeProfile(profileId: number, userId: string): Promise<void> {
    const profile = await memoryTestProfileRepository.findById(profileId);
    if (!profile) {
      throw new Error(`Perfil com ID ${profileId} não encontrado`);
    }

    if (profile.status !== 'active') {
      throw new Error('Apenas perfis ativos podem ser executados');
    }

    // Validar perfil antes da execução
    const validation = await this.validateProfileForExecution(profile);
    if (!validation.isValid) {
      throw new Error(
        `Perfil inválido para execução: ${validation.errors.join(', ')}`
      );
    }

    // Criar snapshot do perfil para auditoria
    const snapshot = await memoryTestProfileRepository.createSnapshot(
      profileId,
      userId
    );

    // Preparar dados para envio ao hardware
    const hardwareData = this.prepareHardwareData(profile);

    try {
      // Enviar parâmetros ao hardware via BLE
      await this.hardwareService.sendJson(hardwareData);

      console.log(`Perfil ${profile.name} executado com sucesso`, {
        profileId,
        userId,
        snapshotId: snapshot.id,
        temperature: profile.targetTemperature,
        time: `${profile.totalTime.minutes}:${profile.totalTime.seconds.toString().padStart(2, '0')}`,
      });
    } catch (error) {
      console.error('Erro ao executar perfil:', error);
      throw new Error(`Falha na comunicação com hardware: ${error}`);
    }
  }

  async getActiveProfile(testType: string): Promise<TestProfile | null> {
    const profiles = await memoryTestProfileRepository.findByTestType(testType);
    return profiles.find(profile => profile.status === 'active') || null;
  }

  async validateProfileForExecution(
    profile: TestProfile
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Verificar se o hardware está conectado
    if (!this.hardwareService.isConnected) {
      errors.push('Hardware não está conectado');
    }

    // Verificar se a temperatura está dentro dos limites seguros
    if (profile.targetTemperature < 20 || profile.targetTemperature > 85) {
      errors.push(
        `Temperatura fora dos limites seguros: ${profile.targetTemperature}°C`
      );
    }

    // Verificar se o tempo está dentro dos limites
    const totalMinutes =
      profile.totalTime.minutes + profile.totalTime.seconds / 60;
    if (totalMinutes < 1 || totalMinutes > 120) {
      errors.push(`Tempo fora dos limites: ${totalMinutes} min`);
    }

    // Verificar se o perfil está ativo
    if (profile.status !== 'active') {
      errors.push('Perfil não está ativo');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private prepareHardwareData(profile: TestProfile) {
    // Converter dados do perfil para o formato esperado pelo hardware
    return {
      batteryPercent: 100, // Será atualizado pelo hardware
      blockTemperatureC: profile.targetTemperature,
      blockHeatingTime: {
        hours: Math.floor(profile.totalTime.minutes / 60),
        minutes: profile.totalTime.minutes % 60,
      },
      equipmentStatus: 'standby' as const,
      analysisElapsed: { hours: 0, minutes: 0 },
      preTestStatus: 'not_started' as const,
      testType: profile.testType,
    };
  }
}

// Hook para usar o serviço de execução de perfis
export const useProfileExecution = (hardwareService: HardwareService) => {
  const { logUserAction } = useNavigationLogger({
    screenName: 'ProfileExecution',
    additionalContext: { service: 'profile_execution' },
  });

  const service = new ProfileExecutionServiceImpl(hardwareService);

  const executeProfile = async (profileId: number, userId: string) => {
    try {
      logUserAction('profile_execution_start', {
        profileId,
        userId,
        timestamp: Date.now(),
      });

      await service.executeProfile(profileId, userId);

      logUserAction('profile_execution_success', {
        profileId,
        userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logUserAction('profile_execution_error', {
        profileId,
        userId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: Date.now(),
      });
      throw error;
    }
  };

  const getActiveProfile = async (testType: string) => {
    return service.getActiveProfile(testType);
  };

  const validateProfile = async (profile: TestProfile) => {
    return service.validateProfileForExecution(profile);
  };

  return {
    executeProfile,
    getActiveProfile,
    validateProfile,
  };
};
