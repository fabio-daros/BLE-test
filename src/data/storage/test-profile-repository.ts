import {
  TestProfile,
  TestProfileSnapshot,
  CreateTestProfileRequest,
  UpdateTestProfileRequest,
  TestProfileRepository,
  TestProfileValidation,
  ProfileStatus,
  TEST_PROFILE_LIMITS,
  HardwareTestType,
} from '@/types/test-profile';
import { profileAuditLogger, getProfileChanges } from '@services/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Chave para armazenar perfis no AsyncStorage
const STORAGE_KEY = '@test_profiles';
const STORAGE_SNAPSHOTS_KEY = '@test_profile_snapshots';
const STORAGE_NEXT_ID_KEY = '@test_profiles_next_id';
const STORAGE_NEXT_SNAPSHOT_ID_KEY = '@test_profile_snapshots_next_id';

class MemoryTestProfileRepository implements TestProfileRepository {
  private profiles: Map<number, TestProfile> = new Map();
  private snapshots: Map<number, TestProfileSnapshot> = new Map();
  private nextId = 1;
  private nextSnapshotId = 1;
  private initializationPromise: Promise<void>;

  constructor() {
    // Criar Promise de inicialização que será aguardada
    this.initializationPromise = this.initialize();
  }

  /**
   * Inicializa o repositório: carrega dados do storage e cria perfis padrão
   */
  private async initialize(): Promise<void> {
    try {
      // 1. Carregar dados do AsyncStorage
      await this.loadFromStorage();
      
      // 2. Inicializar perfis padrão (só se não houver dados)
      await this.initializeDefaultProfiles();
      
      console.log('[TestProfileRepository] Inicialização completa');
    } catch (error) {
      console.error('[TestProfileRepository] Erro na inicialização:', error);
      // Tentar inicializar perfis padrão mesmo com erro
      try {
        await this.initializeDefaultProfiles();
      } catch (e) {
        console.error('[TestProfileRepository] Erro ao inicializar perfis padrão:', e);
      }
    }
  }

  /**
   * Aguarda a inicialização estar completa antes de executar operações
   */
  private async ensureInitialized(): Promise<void> {
    await this.initializationPromise;
  }

  /**
   * Carrega perfis do AsyncStorage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      // Carregar perfis
      const profilesJson = await AsyncStorage.getItem(STORAGE_KEY);
      if (profilesJson) {
        const profilesArray: TestProfile[] = JSON.parse(profilesJson);
        this.profiles = new Map(
          profilesArray.map(profile => [profile.id, profile])
        );
        console.log(`[TestProfileRepository] Carregados ${profilesArray.length} perfis do AsyncStorage`);
        
        // Calcular próximo ID baseado nos perfis carregados
        const maxId = profilesArray.length > 0 
          ? Math.max(...profilesArray.map(p => p.id))
          : 0;
        this.nextId = maxId + 1;
      }

      // Carregar snapshots
      const snapshotsJson = await AsyncStorage.getItem(STORAGE_SNAPSHOTS_KEY);
      if (snapshotsJson) {
        const snapshotsArray: TestProfileSnapshot[] = JSON.parse(snapshotsJson);
        this.snapshots = new Map(
          snapshotsArray.map(snapshot => [snapshot.id, snapshot])
        );
        
        const maxSnapshotId = snapshotsArray.length > 0
          ? Math.max(...snapshotsArray.map(s => s.id))
          : 0;
        this.nextSnapshotId = maxSnapshotId + 1;
      }

      // Carregar próximo ID salvo (se existir)
      const savedNextId = await AsyncStorage.getItem(STORAGE_NEXT_ID_KEY);
      if (savedNextId) {
        const parsedId = parseInt(savedNextId, 10);
        if (!isNaN(parsedId) && parsedId > this.nextId) {
          this.nextId = parsedId;
        }
      }

      const savedNextSnapshotId = await AsyncStorage.getItem(STORAGE_NEXT_SNAPSHOT_ID_KEY);
      if (savedNextSnapshotId) {
        const parsedId = parseInt(savedNextSnapshotId, 10);
        if (!isNaN(parsedId) && parsedId > this.nextSnapshotId) {
          this.nextSnapshotId = parsedId;
        }
      }
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao carregar do AsyncStorage:', error);
      throw error; // Propagar erro para tratamento no initialize()
    }
  }

  /**
   * Salva perfis no AsyncStorage
   */
  private async saveToStorage(): Promise<void> {
    try {
      // Salvar perfis
      const profilesArray = Array.from(this.profiles.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profilesArray));

      // Salvar snapshots
      const snapshotsArray = Array.from(this.snapshots.values());
      await AsyncStorage.setItem(STORAGE_SNAPSHOTS_KEY, JSON.stringify(snapshotsArray));

      // Salvar próximo ID
      await AsyncStorage.setItem(STORAGE_NEXT_ID_KEY, this.nextId.toString());
      await AsyncStorage.setItem(STORAGE_NEXT_SNAPSHOT_ID_KEY, this.nextSnapshotId.toString());

      console.log(`[TestProfileRepository] Perfis salvos no AsyncStorage (${profilesArray.length} perfis)`);
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao salvar no AsyncStorage:', error);
      throw new Error('Falha ao salvar perfis no armazenamento local');
    }
  }

  private async initializeDefaultProfiles(): Promise<void> {
    // Só criar perfis padrão se não houver nenhum perfil salvo
    if (this.profiles.size === 0) {
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
        },
        hardwareTestType: 'colorimetric', // Adicionar
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
      
      // Salvar no AsyncStorage (com await)
      try {
        await this.saveToStorage();
      } catch (error) {
        console.error('[TestProfileRepository] Erro ao salvar perfil padrão:', error);
        // Não bloquear a inicialização se houver erro ao salvar
      }
    }
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
      const totalMinutes = profile.totalTime.minutes; // Remover conversão de seconds
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
    await this.ensureInitialized();
    try {
      const now = Date.now();
      const profile: TestProfile = {
        id: this.nextId++,
        name: request.name,
        ...(request.description !== undefined && { description: request.description }),
        testType: request.testType,
        targetTemperature: request.targetTemperature,
        totalTime: {
          minutes: request.totalTimeMinutes,
        },
        hardwareTestType: request.hardwareTestType, // Adicionar
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
      
      // Salvar no AsyncStorage
      await this.saveToStorage();
      
      return profile;
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao criar perfil:', error);
      throw error;
    }
  }

  async findById(id: number): Promise<TestProfile | null> {
    await this.ensureInitialized();
    return this.profiles.get(id) || null;
  }

  async findAll(): Promise<TestProfile[]> {
    await this.ensureInitialized();
    return Array.from(this.profiles.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  async findByStatus(status: ProfileStatus): Promise<TestProfile[]> {
    await this.ensureInitialized();
    return Array.from(this.profiles.values())
      .filter(profile => profile.status === status)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async findByTestType(testType: string): Promise<TestProfile[]> {
    await this.ensureInitialized();
    return Array.from(this.profiles.values())
      .filter(profile => profile.testType === testType)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async update(
    id: number,
    updates: UpdateTestProfileRequest,
    userId: string
  ): Promise<TestProfile> {
    await this.ensureInitialized();
    try {
      const existingProfile = this.profiles.get(id);
      if (!existingProfile) {
        throw new Error(`Perfil com ID ${id} não encontrado`);
      }

      // Preparar os campos para atualização
      const { totalTimeMinutes, ...restUpdates } = updates;

      const updatedProfile: TestProfile = {
        ...existingProfile,
        ...restUpdates,
        id,
        updatedAt: Date.now(),
        updatedBy: userId,
        totalTime:
          totalTimeMinutes !== undefined
            ? {
                minutes: totalTimeMinutes,
              }
            : existingProfile.totalTime,
      };

      if (updates.totalTimeMinutes !== undefined) {
        updatedProfile.totalTime = {
          minutes: updates.totalTimeMinutes,
        };
      }

      if (updates.hardwareTestType !== undefined) {
        updatedProfile.hardwareTestType = updates.hardwareTestType;
      }

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
      
      // Salvar no AsyncStorage
      await this.saveToStorage();
      
      return updatedProfile;
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao atualizar perfil:', error);
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    await this.ensureInitialized();
    try {
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
      
      // Salvar no AsyncStorage
      await this.saveToStorage();
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao deletar perfil:', error);
      throw error;
    }
  }

  async activate(id: number, userId: string): Promise<TestProfile> {
    await this.ensureInitialized();
    try {
      const profile = this.profiles.get(id);
      if (!profile) {
        throw new Error(`Perfil com ID ${id} não encontrado`);
      }

      const updatedProfile: TestProfile = {
        ...profile,
        status: 'active',
        updatedAt: Date.now(),
        updatedBy: userId,
      };

      this.profiles.set(id, updatedProfile);
      profileAuditLogger.logProfileActivated(updatedProfile, userId);
      
      // Salvar no AsyncStorage
      await this.saveToStorage();
      
      return updatedProfile;
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao ativar perfil:', error);
      throw error;
    }
  }

  async archive(id: number, userId: string): Promise<TestProfile> {
    await this.ensureInitialized();
    try {
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
      
      // Salvar no AsyncStorage
      await this.saveToStorage();
      
      return updatedProfile;
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao arquivar perfil:', error);
      throw error;
    }
  }

  async createSnapshot(
    profileId: number,
    userId: string,
    testExecutionId?: string
  ): Promise<TestProfileSnapshot> {
    await this.ensureInitialized();
    try {
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
        totalTime: {
          minutes: profile.totalTime.minutes,
        },
        executedAt: Date.now(),
        executedBy: userId,
        ...(testExecutionId !== undefined && { testExecutionId }),
      };

      this.snapshots.set(snapshot.id, snapshot);
      profileAuditLogger.logProfileExecuted(snapshot, userId);
      
      // Salvar no AsyncStorage
      await this.saveToStorage();
      
      return snapshot;
    } catch (error) {
      console.error('[TestProfileRepository] Erro ao criar snapshot:', error);
      throw error;
    }
  }

  async getSnapshots(profileId?: number): Promise<TestProfileSnapshot[]> {
    await this.ensureInitialized();
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
