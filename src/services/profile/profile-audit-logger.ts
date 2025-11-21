import { logger } from '@services/logging';
import { TestProfile, TestProfileSnapshot } from '@/types/test-profile';

export interface ProfileAuditLogger {
  logProfileCreated(profile: TestProfile, userId: string): void;
  logProfileUpdated(
    profile: TestProfile,
    changes: string[],
    userId: string
  ): void;
  logProfileActivated(profile: TestProfile, userId: string): void;
  logProfileArchived(profile: TestProfile, userId: string): void;
  logProfileDeleted(
    profileId: number,
    profileName: string,
    userId: string
  ): void;
  logProfileExecuted(snapshot: TestProfileSnapshot, userId: string): void;
  logProfileValidationFailed(
    profile: Partial<TestProfile>,
    errors: string[],
    userId: string
  ): void;
}

class ProfileAuditLoggerImpl implements ProfileAuditLogger {
  private logAction(action: string, metadata: object): void {
    logger.info(`Profile Audit: ${action}`, metadata, 'PROFILE_AUDIT');
  }

  logProfileCreated(profile: TestProfile, userId: string): void {
    this.logAction('profile_created', {
      profileId: profile.id,
      profileName: profile.name,
      testType: profile.testType,
      targetTemperature: profile.targetTemperature,
      totalTimeMinutes: profile.totalTime.minutes,
      status: profile.status,
      userId,
      timestamp: Date.now(),
    });
  }

  logProfileUpdated(
    profile: TestProfile,
    changes: string[],
    userId: string
  ): void {
    this.logAction('profile_updated', {
      profileId: profile.id,
      profileName: profile.name,
      changes,
      userId,
      timestamp: Date.now(),
    });
  }

  logProfileActivated(profile: TestProfile, userId: string): void {
    this.logAction('profile_activated', {
      profileId: profile.id,
      profileName: profile.name,
      testType: profile.testType,
      targetTemperature: profile.targetTemperature,
      totalTimeMinutes: profile.totalTime.minutes,
      userId,
      timestamp: Date.now(),
    });
  }

  logProfileArchived(profile: TestProfile, userId: string): void {
    this.logAction('profile_archived', {
      profileId: profile.id,
      profileName: profile.name,
      testType: profile.testType,
      userId,
      timestamp: Date.now(),
    });
  }

  logProfileDeleted(
    profileId: number,
    profileName: string,
    userId: string
  ): void {
    this.logAction('profile_deleted', {
      profileId,
      profileName,
      userId,
      timestamp: Date.now(),
    });
  }

  logProfileExecuted(snapshot: TestProfileSnapshot, userId: string): void {
    this.logAction('profile_executed', {
      snapshotId: snapshot.id,
      profileId: snapshot.profileId,
      profileName: snapshot.profileName,
      testType: snapshot.testType,
      targetTemperature: snapshot.targetTemperature,
      totalTimeMinutes: snapshot.totalTime.minutes,
      testExecutionId: snapshot.testExecutionId,
      userId,
      timestamp: Date.now(),
    });
  }

  logProfileValidationFailed(
    profile: Partial<TestProfile>,
    errors: string[],
    userId: string
  ): void {
    this.logAction('profile_validation_failed', {
      profileId: profile.id,
      profileName: profile.name,
      testType: profile.testType,
      targetTemperature: profile.targetTemperature,
      errors,
      userId,
      timestamp: Date.now(),
    });
  }
}

// Instância singleton do logger de auditoria
export const profileAuditLogger = new ProfileAuditLoggerImpl();

// Hook para usar o logger de auditoria de perfis (para compatibilidade com componentes React)
export const useProfileAuditLogger = (): ProfileAuditLogger => {
  return profileAuditLogger;
};

// Função utilitária para comparar perfis e identificar mudanças
export const getProfileChanges = (
  oldProfile: TestProfile,
  newProfile: TestProfile
): string[] => {
  const changes: string[] = [];

  if (oldProfile.name !== newProfile.name) {
    changes.push(`Nome: "${oldProfile.name}" → "${newProfile.name}"`);
  }

  if (oldProfile.description !== newProfile.description) {
    changes.push(
      `Descrição: "${oldProfile.description || 'N/A'}" → "${newProfile.description || 'N/A'}"`
    );
  }

  if (oldProfile.testType !== newProfile.testType) {
    changes.push(
      `Tipo de teste: "${oldProfile.testType}" → "${newProfile.testType}"`
    );
  }

  if (oldProfile.targetTemperature !== newProfile.targetTemperature) {
    changes.push(
      `Temperatura: ${oldProfile.targetTemperature}°C → ${newProfile.targetTemperature}°C`
    );
  }

  if (oldProfile.totalTime.minutes !== newProfile.totalTime.minutes) {
    const oldTime = `${oldProfile.totalTime.minutes}min`;
    const newTime = `${newProfile.totalTime.minutes}min`;
    changes.push(`Tempo: ${oldTime} → ${newTime}`);
  }

  if (oldProfile.status !== newProfile.status) {
    changes.push(`Status: "${oldProfile.status}" → "${newProfile.status}"`);
  }

  return changes;
};
