export type ProfileStatus = 'draft' | 'active' | 'archived';
export type HardwareTestType = 'colorimetric' | 'fluorimetric';

export interface TestProfile {
  id: number;
  name: string;
  description?: string;
  testType: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom';
  targetTemperature: number; // °C (0.1°C increments)
  totalTime: {
    minutes: number;
    // Removido seconds - hardware só usa minutos
  }; // mm format
  hardwareTestType: HardwareTestType; // Tipo de leitura do hardware
  status: ProfileStatus;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  createdBy: string; // user identifier
  updatedBy: string; // user identifier
}

export interface TestProfileSnapshot {
  id: number;
  profileId: number;
  profileName: string;
  testType: string;
  targetTemperature: number;
  totalTime: {
    minutes: number;
    // Removido seconds - hardware só usa minutos
  };
  executedAt: number; // timestamp
  executedBy: string; // user identifier
  testExecutionId?: string; // optional link to test execution
}

export interface TestProfileValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestProfileLimits {
  temperature: {
    min: number; // 20°C
    max: number; // 85°C
    recommendedMin: number; // 55°C
    recommendedMax: number; // 70°C
    increment: number; // 0.1°C
  };
  time: {
    minMinutes: number; // 1 min
    maxMinutes: number; // 120 min
    incrementSeconds: number; // 5s
  };
}

export const TEST_PROFILE_LIMITS: TestProfileLimits = {
  temperature: {
    min: 20,
    max: 85,
    recommendedMin: 55,
    recommendedMax: 70,
    increment: 0.1,
  },
  time: {
    minMinutes: 1,
    maxMinutes: 120,
    incrementSeconds: 5,
  },
};

export interface CreateTestProfileRequest {
  name: string;
  description?: string;
  testType: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom';
  targetTemperature: number;
  totalTimeMinutes: number;
  // Removido totalTimeSeconds
  hardwareTestType: HardwareTestType; // Novo campo obrigatório
}

export interface UpdateTestProfileRequest {
  id: number;
  name?: string;
  description?: string;
  testType?: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom';
  targetTemperature?: number;
  totalTimeMinutes?: number;
  // Removido totalTimeSeconds
  hardwareTestType?: HardwareTestType; // Novo campo opcional
}

export interface TestProfileRepository {
  create(
    profile: CreateTestProfileRequest,
    userId: string
  ): Promise<TestProfile>;
  findById(id: number): Promise<TestProfile | null>;
  findAll(): Promise<TestProfile[]>;
  findByStatus(status: ProfileStatus): Promise<TestProfile[]>;
  findByTestType(testType: string): Promise<TestProfile[]>;
  update(
    id: number,
    updates: UpdateTestProfileRequest,
    userId: string
  ): Promise<TestProfile>;
  delete(id: number): Promise<void>;
  activate(id: number, userId: string): Promise<TestProfile>;
  archive(id: number, userId: string): Promise<TestProfile>;
  createSnapshot(
    profileId: number,
    userId: string,
    testExecutionId?: string
  ): Promise<TestProfileSnapshot>;
  getSnapshots(profileId?: number): Promise<TestProfileSnapshot[]>;
}
