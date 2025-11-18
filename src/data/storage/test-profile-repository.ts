import {
  TestProfile,
  TestProfileSnapshot,
  CreateTestProfileRequest,
  UpdateTestProfileRequest,
  TestProfileRepository,
  TestProfileValidation,
  ProfileStatus,
  TEST_PROFILE_LIMITS,
} from '@/types/test-profile';
import { profileAuditLogger, getProfileChanges } from '@services/profile';

class MemoryTestProfileRepository implements TestProfileRepository {
  private profiles: Map<number, TestProfile> = new Map();
  private snapshots: Map<number, TestProfileSnapshot> = new Map();
  private nextId = 1;
  private nextSnapshotId = 1;

  constructor() {
    // Inicializar com perfis padrão
    this.initializeDefaultProfiles();
  }

  private initializeDefaultProfiles(): void {
    // Criar apenas o perfil padrão de Cinomose e ativá-lo automaticamente
    const now = Date.now();
    const cinomoseProfile: TestProfile = {
      id: this.nextId++,
      name: 'Cinomose',
      description: 'Perfil padrão para teste de Cinomose',
      testType: 'cinomose',
      targetTemperature: 65.0,
      totalTime: {
        minutes: 15,
        seconds: 0,
      },
      status: 'active', // Ativar automaticamente
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
    };

    // Validar o perfil antes de criar
    const validation = this.validateProfile(cinomoseProfile);
    if (!validation.isValid) {
      console.error(
        'Erro ao criar perfil padrão de Cinomose:',
        validation.errors
      );
      return;
    }

    // Criar o perfil diretamente no Map
    this.profiles.set(cinomoseProfile.id, cinomoseProfile);
    profileAuditLogger.logProfileCreated(cinomoseProfile, 'system');
  }

  private validateProfile(
    profile: Partial<TestProfile>
  ): TestProfileValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validação de temperatura
    if (profile.targetTemperature !== undefined) {
      const temp = profile.targetTemperature;
      if (temp < TEST_PROFILE_LIMITS.temperature.min) {
        errors.push(
          `Temperatura muito baixa: ${temp}°C (mínimo: ${TEST_PROFILE_LIMITS.temperature.min}°C)`
        );
      }
      if (temp > TEST_PROFILE_LIMITS.temperature.max) {
        errors.push(
          `Temperatura muito alta: ${temp}°C (máximo: ${TEST_PROFILE_LIMITS.temperature.max}°C)`
        );
      }
      if (
        temp < TEST_PROFILE_LIMITS.temperature.recommendedMin ||
        temp > TEST_PROFILE_LIMITS.temperature.recommendedMax
      ) {
        warnings.push(
          `Temperatura fora da faixa recomendada: ${temp}°C (recomendado: ${TEST_PROFILE_LIMITS.temperature.recommendedMin}-${TEST_PROFILE_LIMITS.temperature.recommendedMax}°C)`
        );
      }
    }

    // Validação de tempo
    if (profile.totalTime !== undefined) {
      const totalMinutes =
        profile.totalTime.minutes + profile.totalTime.seconds / 60;
      if (totalMinutes < TEST_PROFILE_LIMITS.time.minMinutes) {
        errors.push(
          `Tempo muito curto: ${totalMinutes} min (mínimo: ${TEST_PROFILE_LIMITS.time.minMinutes} min)`
        );
      }
      if (totalMinutes > TEST_PROFILE_LIMITS.time.maxMinutes) {
        errors.push(
          `Tempo muito longo: ${totalMinutes} min (máximo: ${TEST_PROFILE_LIMITS.time.maxMinutes} min)`
        );
      }
    }

    // Validação de nome
    if (profile.name !== undefined) {
      if (!profile.name.trim()) {
        errors.push('Nome do perfil é obrigatório');
      }
      if (profile.name.length > 50) {
        errors.push('Nome do perfil muito longo (máximo 50 caracteres)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async create(
    request: CreateTestProfileRequest,
    userId: string
  ): Promise<TestProfile> {
    const now = Date.now();
    const profile: TestProfile = {
      id: this.nextId++,
      name: request.name,
      ...(request.description !== undefined && { description: request.description }),
      testType: request.testType,
      targetTemperature: request.targetTemperature,
      totalTime: {
        minutes: request.totalTimeMinutes,
        seconds: request.totalTimeSeconds,
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const validation = this.validateProfile(profile);
    if (!validation.isValid) {
      profileAuditLogger.logProfileValidationFailed(
        profile,
        validation.errors,
        userId
      );
      throw new Error(`Perfil inválido: ${validation.errors.join(', ')}`);
    }

    this.profiles.set(profile.id, profile);
    profileAuditLogger.logProfileCreated(profile, userId);
    return profile;
  }

  async findById(id: number): Promise<TestProfile | null> {
    return this.profiles.get(id) || null;
  }

  async findAll(): Promise<TestProfile[]> {
    return Array.from(this.profiles.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  async findByStatus(status: ProfileStatus): Promise<TestProfile[]> {
    return Array.from(this.profiles.values())
      .filter(profile => profile.status === status)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async findByTestType(testType: string): Promise<TestProfile[]> {
    return Array.from(this.profiles.values())
      .filter(profile => profile.testType === testType)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async update(
    id: number,
    updates: UpdateTestProfileRequest,
    userId: string
  ): Promise<TestProfile> {
    const existingProfile = this.profiles.get(id);
    if (!existingProfile) {
      throw new Error(`Perfil com ID ${id} não encontrado`);
    }

    // Preparar os campos para atualização, convertendo totalTimeMinutes/totalTimeSeconds em totalTime
    const { totalTimeMinutes, totalTimeSeconds, ...restUpdates } = updates;

    const updatedProfile: TestProfile = {
      ...existingProfile,
      ...restUpdates,
      id, // Garantir que o ID não seja alterado
      updatedAt: Date.now(),
      updatedBy: userId,
      // Atualizar totalTime apenas se totalTimeMinutes ou totalTimeSeconds foram fornecidos
      totalTime:
        totalTimeMinutes !== undefined || totalTimeSeconds !== undefined
          ? {
              minutes: totalTimeMinutes ?? existingProfile.totalTime.minutes,
              seconds: totalTimeSeconds ?? existingProfile.totalTime.seconds,
            }
          : existingProfile.totalTime,
    };

    // Validar apenas os campos que estão sendo atualizados
    const validation = this.validateProfile(updatedProfile);
    if (!validation.isValid) {
      profileAuditLogger.logProfileValidationFailed(
        updatedProfile,
        validation.errors,
        userId
      );
      throw new Error(`Perfil inválido: ${validation.errors.join(', ')}`);
    }

    const changes = getProfileChanges(existingProfile, updatedProfile);
    this.profiles.set(id, updatedProfile);
    profileAuditLogger.logProfileUpdated(updatedProfile, changes, userId);
    return updatedProfile;
  }

  async delete(id: number): Promise<void> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Perfil com ID ${id} não encontrado`);
    }

    if (profile.status === 'active') {
      throw new Error(
        'Não é possível deletar um perfil ativo. Arquivar primeiro.'
      );
    }

    profileAuditLogger.logProfileDeleted(id, profile.name, 'system');
    this.profiles.delete(id);
  }

  async activate(id: number, userId: string): Promise<TestProfile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Perfil com ID ${id} não encontrado`);
    }

    // Ativar o perfil selecionado (permitindo múltiplos perfis ativos)
    const updatedProfile: TestProfile = {
      ...profile,
      status: 'active',
      updatedAt: Date.now(),
      updatedBy: userId,
    };

    this.profiles.set(id, updatedProfile);
    profileAuditLogger.logProfileActivated(updatedProfile, userId);
    return updatedProfile;
  }

  async archive(id: number, userId: string): Promise<TestProfile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Perfil com ID ${id} não encontrado`);
    }

    const updatedProfile: TestProfile = {
      ...profile,
      status: 'archived',
      updatedAt: Date.now(),
      updatedBy: userId,
    };

    this.profiles.set(id, updatedProfile);
    profileAuditLogger.logProfileArchived(updatedProfile, userId);
    return updatedProfile;
  }

  async createSnapshot(
    profileId: number,
    userId: string,
    testExecutionId?: string
  ): Promise<TestProfileSnapshot> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Perfil com ID ${profileId} não encontrado`);
    }

    const snapshot: TestProfileSnapshot = {
      id: this.nextSnapshotId++,
      profileId,
      profileName: profile.name,
      testType: profile.testType,
      targetTemperature: profile.targetTemperature,
      totalTime: { ...profile.totalTime },
      executedAt: Date.now(),
      executedBy: userId,
      ...(testExecutionId !== undefined && { testExecutionId }),
    };

    this.snapshots.set(snapshot.id, snapshot);
    profileAuditLogger.logProfileExecuted(snapshot, userId);
    return snapshot;
  }

  async getSnapshots(profileId?: number): Promise<TestProfileSnapshot[]> {
    const snapshots = Array.from(this.snapshots.values());

    if (profileId) {
      return snapshots
        .filter(snapshot => snapshot.profileId === profileId)
        .sort((a, b) => b.executedAt - a.executedAt);
    }

    return snapshots.sort((a, b) => b.executedAt - a.executedAt);
  }
}

export const memoryTestProfileRepository = new MemoryTestProfileRepository();
