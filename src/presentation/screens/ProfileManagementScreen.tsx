import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useNavigationLogger } from '@services/logging';
import { memoryTestProfileRepository } from '@data/storage';
import {
  TestProfile,
  CreateTestProfileRequest,
  UpdateTestProfileRequest,
  ProfileStatus,
  HardwareTestType,
} from '@/types/test-profile';
import { colors } from '@presentation/theme';
import type { HardwareTestType as HardwareTestTypeType } from '@/types/test-profile';

interface ProfileManagementScreenProps {
  onNavigateBack: () => void;
}

export const ProfileManagementScreen: React.FC<
  ProfileManagementScreenProps
> = ({ onNavigateBack }) => {
  const [profiles, setProfiles] = useState<TestProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TestProfile | null>(
    null
  );
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>(
    'all'
  );

  const { logUserAction } = useNavigationLogger({
    screenName: 'ProfileManagementScreen',
    additionalContext: { isAdminPanel: true },
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const allProfiles = await memoryTestProfileRepository.findAll();
      setProfiles(allProfiles);
      logUserAction('profiles_loaded', { count: allProfiles.length });
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      Alert.alert('Erro', 'Falha ao carregar perfis');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (profileData: CreateTestProfileRequest) => {
    try {
      await memoryTestProfileRepository.create(profileData, 'admin');
      await loadProfiles();
      setShowCreateModal(false);
      logUserAction('profile_created', {
        name: profileData.name,
        testType: profileData.testType,
      });
      Alert.alert('Sucesso', 'Perfil criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar perfil:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Falha ao criar perfil';
      Alert.alert('Erro', errorMessage);
      // Não fechar o modal em caso de erro para o usuário poder tentar novamente
      // Não re-lançar o erro para evitar Promise não tratada
    }
  };

  const handleUpdateProfile = async (profileData: UpdateTestProfileRequest) => {
    if (!editingProfile) return;

    try {
      await memoryTestProfileRepository.update(
        editingProfile.id,
        profileData,
        'admin'
      );
      await loadProfiles();
      setShowEditModal(false);
      setEditingProfile(null);
      logUserAction('profile_updated', {
        profileId: editingProfile.id,
        updates: Object.keys(profileData),
      });
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Falha ao atualizar perfil'
      );
    }
  };

  const handleActivateProfile = async (profile: TestProfile) => {
    try {
      await memoryTestProfileRepository.activate(profile.id, 'admin');
      await loadProfiles();
      logUserAction('profile_activated', {
        profileId: profile.id,
        testType: profile.testType,
      });
      Alert.alert('Sucesso', `Perfil "${profile.name}" ativado!`);
    } catch (error) {
      console.error('Erro ao ativar perfil:', error);
      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : 'Falha ao ativar perfil'
      );
    }
  };

  const handleArchiveProfile = async (profile: TestProfile) => {
    Alert.alert(
      'Arquivar Perfil',
      `Tem certeza que deseja arquivar o perfil "${profile.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await memoryTestProfileRepository.archive(profile.id, 'admin');
              await loadProfiles();
              logUserAction('profile_archived', { profileId: profile.id });
              Alert.alert('Sucesso', 'Perfil arquivado com sucesso!');
            } catch (error) {
              console.error('Erro ao arquivar perfil:', error);
              Alert.alert(
                'Erro',
                error instanceof Error
                  ? error.message
                  : 'Falha ao arquivar perfil'
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteProfile = async (profile: TestProfile) => {
    Alert.alert(
      'Deletar Perfil',
      `Tem certeza que deseja deletar permanentemente o perfil "${profile.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            try {
              await memoryTestProfileRepository.delete(profile.id);
              await loadProfiles();
              logUserAction('profile_deleted', { profileId: profile.id });
              Alert.alert('Sucesso', 'Perfil deletado com sucesso!');
            } catch (error) {
              console.error('Erro ao deletar perfil:', error);
              Alert.alert(
                'Erro',
                error instanceof Error
                  ? error.message
                  : 'Falha ao deletar perfil'
              );
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: ProfileStatus) => {
    switch (status) {
      case 'active':
        return colors.successAlt2;
      case 'draft':
        return colors.warningAlt;
      case 'archived':
        return colors.textMuted;
      default:
        return colors.textMuted;
    }
  };

  const getStatusText = (status: ProfileStatus) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'draft':
        return 'Rascunho';
      case 'archived':
        return 'Arquivado';
      default:
        return 'Desconhecido';
    }
  };

  const getTestTypeText = (testType: string) => {
    switch (testType) {
      case 'cinomose':
        return 'Cinomose';
      case 'ibv_geral':
        return 'IBV Geral';
      case 'ibv_especifico':
        return 'IBV Específico';
      case 'custom':
        return 'Personalizado';
      default:
        return testType;
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    if (filter === 'all') return true;
    return profile.status === filter;
  });

  const renderProfileCard = (profile: TestProfile) => (
    <View key={profile.id} style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <Text style={styles.profileName}>{profile.name}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(profile.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusText(profile.status)}</Text>
        </View>
      </View>

      <Text style={styles.profileDescription}>
        {profile.description || 'Sem descrição'}
      </Text>

      <View style={styles.profileDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tipo:</Text>
          <Text style={styles.detailValue}>
            {getTestTypeText(profile.testType)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Temperatura:</Text>
          <Text style={styles.detailValue}>{profile.targetTemperature}°C</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tempo:</Text>
          <Text style={styles.detailValue}>
            {profile.totalTime.minutes}min
          </Text>
        </View>
      </View>

      <View style={styles.profileActions}>
        {profile.status !== 'active' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.activateButton]}
            onPress={() => handleActivateProfile(profile)}
          >
            <Text style={styles.actionButtonText}>Ativar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => {
            setEditingProfile(profile);
            setShowEditModal(true);
          }}
        >
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>

        {profile.status !== 'active' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteProfile(profile)}
          >
            <Text style={styles.actionButtonText}>Deletar</Text>
          </TouchableOpacity>
        )}

        {profile.status === 'active' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.archiveButton]}
            onPress={() => handleArchiveProfile(profile)}
          >
            <Text style={styles.actionButtonText}>Arquivar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.loadingText}>Carregando perfis...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onNavigateBack}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Gerenciar Perfis</Text>
        </View>

        {/* Filtros */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['all', 'active', 'draft', 'archived'] as const).map(
              filterType => (
                <TouchableOpacity
                  key={filterType}
                  style={[
                    styles.filterButton,
                    filter === filterType && styles.filterButtonActive,
                  ]}
                  onPress={() => setFilter(filterType)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filter === filterType && styles.filterButtonTextActive,
                    ]}
                  >
                    {filterType === 'all' ? 'Todos' : getStatusText(filterType)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>

        {/* Lista de Perfis */}
        <ScrollView style={styles.profilesList}>
          {filteredProfiles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {filter === 'all'
                  ? 'Nenhum perfil encontrado'
                  : `Nenhum perfil ${getStatusText(filter).toLowerCase()} encontrado`}
              </Text>
            </View>
          ) : (
            filteredProfiles.map(renderProfileCard)
          )}
        </ScrollView>

        {/* Botão de Criar */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ Criar Novo Perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Criar Perfil */}
      <CreateProfileModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProfile} // handleCreateProfile é async, então sempre retorna Promise
      />

      {/* Modal de Editar Perfil */}
      <EditProfileModal
        visible={showEditModal}
        profile={editingProfile}
        onClose={() => {
          setShowEditModal(false);
          setEditingProfile(null);
        }}
        onSubmit={handleUpdateProfile}
      />
    </SafeAreaView>
  );
};

// Modal para criar perfil
const CreateProfileModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (profile: CreateTestProfileRequest) => Promise<void>; // Sempre Promise
}> = ({ visible, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateTestProfileRequest>({
    name: '',
    description: '',
    testType: 'custom',
    targetTemperature: 65.0,
    totalTimeMinutes: 15,
    hardwareTestType: 'colorimetric', // Valor padrão
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Erro', 'Nome do perfil é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      // Sempre aguardar onSubmit (é sempre Promise)
      await onSubmit(formData);
      
      // Só limpar o formulário se o submit foi bem-sucedido
      setFormData({
        name: '',
        description: '',
        testType: 'custom',
        targetTemperature: 65.0,
        totalTimeMinutes: 15,
        hardwareTestType: 'colorimetric', // Valor padrão
      });
      
      // O handleCreateProfile já fecha o modal via setShowCreateModal(false)
    } catch (error) {
      // Erro já é tratado em handleCreateProfile
      console.error('Erro ao submeter formulário:', error);
      // Não limpar form em caso de erro
      // Não re-lançar para evitar Promise não tratada
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Criar Novo Perfil</Text>

          <Text style={styles.fieldLabel}>Nome do perfil *</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o nome do perfil"
            value={formData.name}
            onChangeText={text => setFormData({ ...formData, name: text })}
          />

          <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a descrição"
            value={formData.description}
            onChangeText={text =>
              setFormData({ ...formData, description: text })
            }
            multiline
          />

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.fieldLabel}>Temperatura (°C)</Text>
              <TextInput
                style={styles.input}
                placeholder="65.0"
                value={formData.targetTemperature.toString()}
                onChangeText={text =>
                  setFormData({
                    ...formData,
                    targetTemperature: parseFloat(text) || 0,
                  })
                }
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.fieldLabel}>Tempo (minutos)</Text>
              <TextInput
                style={styles.input}
                placeholder="15"
                value={formData.totalTimeMinutes.toString()}
                onChangeText={text =>
                  setFormData({
                    ...formData,
                    totalTimeMinutes: parseInt(text) || 0,
                  })
                }
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Seleção de tipo de hardware */}
          <View style={styles.hardwareTypeRow}>
            <Text style={styles.hardwareTypeLabel}>Tipo de Leitura:</Text>
            <View style={styles.hardwareTypeButtons}>
              <TouchableOpacity
                style={[
                  styles.hardwareTypeButton,
                  formData.hardwareTestType === 'colorimetric' && styles.hardwareTypeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, hardwareTestType: 'colorimetric' })}
              >
                <Text
                  style={[
                    styles.hardwareTypeButtonText,
                    formData.hardwareTestType === 'colorimetric' && styles.hardwareTypeButtonTextActive,
                  ]}
                >
                  Colorimétrico
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.hardwareTypeButton,
                  formData.hardwareTestType === 'fluorimetric' && styles.hardwareTypeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, hardwareTestType: 'fluorimetric' })}
              >
                <Text
                  style={[
                    styles.hardwareTypeButtonText,
                    formData.hardwareTestType === 'fluorimetric' && styles.hardwareTypeButtonTextActive,
                  ]}
                >
                  Fluorimétrico
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Criando...' : 'Criar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Modal para editar perfil
const EditProfileModal: React.FC<{
  visible: boolean;
  profile: TestProfile | null;
  onClose: () => void;
  onSubmit: (profile: UpdateTestProfileRequest) => void;
}> = ({ visible, profile, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<UpdateTestProfileRequest>({
    id: 0,
    name: '',
    description: '',
    testType: 'custom',
    targetTemperature: 65.0,
    totalTimeMinutes: 15,
    // Removido totalTimeSeconds
    hardwareTestType: 'colorimetric', // Adicionar
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        id: profile.id,
        name: profile.name,
        description: profile.description || '',
        testType: profile.testType,
        targetTemperature: profile.targetTemperature,
        totalTimeMinutes: profile.totalTime.minutes,
        // Removido totalTimeSeconds
        hardwareTestType: profile.hardwareTestType || 'colorimetric', // Adicionar com fallback
      });
    }
  }, [profile]);

  const handleSubmit = () => {
    if (!profile) return;
    if (!formData.name?.trim()) {
      Alert.alert('Erro', 'Nome do perfil é obrigatório');
      return;
    }
    // Garantir que sempre enviamos os valores de tempo, mesmo que não tenham sido alterados
    const updateData: UpdateTestProfileRequest = {
      ...formData,
      totalTimeMinutes: formData.totalTimeMinutes ?? profile.totalTime.minutes,
      // Removido totalTimeSeconds
      hardwareTestType: formData.hardwareTestType ?? profile.hardwareTestType, // Adicionar com fallback
    };
    onSubmit(updateData);
  };

  if (!profile) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Editar Perfil</Text>

          <Text style={styles.fieldLabel}>Nome do perfil *</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o nome do perfil"
            value={formData.name}
            onChangeText={text => setFormData({ ...formData, name: text })}
          />

          <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a descrição"
            value={formData.description}
            onChangeText={text =>
              setFormData({ ...formData, description: text })
            }
            multiline
          />

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.fieldLabel}>Temperatura (°C)</Text>
              <TextInput
                style={styles.input}
                placeholder="65.0"
                value={formData.targetTemperature?.toString()}
                onChangeText={text =>
                  setFormData({
                    ...formData,
                    targetTemperature: parseFloat(text) || 0,
                  })
                }
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.fieldLabel}>Tempo (minutos)</Text>
              <TextInput
                style={styles.input}
                placeholder="15"
                value={formData.totalTimeMinutes?.toString()}
                onChangeText={text =>
                  setFormData({
                    ...formData,
                    totalTimeMinutes: parseInt(text) || 0,
                  })
                }
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Seleção de tipo de hardware */}
          <View style={styles.hardwareTypeRow}>
            <Text style={styles.hardwareTypeLabel}>Tipo de Leitura:</Text>
            <View style={styles.hardwareTypeButtons}>
              <TouchableOpacity
                style={[
                  styles.hardwareTypeButton,
                  formData.hardwareTestType === 'colorimetric' && styles.hardwareTypeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, hardwareTestType: 'colorimetric' })}
              >
                <Text
                  style={[
                    styles.hardwareTypeButtonText,
                    formData.hardwareTestType === 'colorimetric' && styles.hardwareTypeButtonTextActive,
                  ]}
                >
                  Colorimétrico
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.hardwareTypeButton,
                  formData.hardwareTestType === 'fluorimetric' && styles.hardwareTypeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, hardwareTestType: 'fluorimetric' })}
              >
                <Text
                  style={[
                    styles.hardwareTypeButtonText,
                    formData.hardwareTestType === 'fluorimetric' && styles.hardwareTypeButtonTextActive,
                  ]}
                >
                  Fluorimétrico
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
            >
              <Text style={styles.submitButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt2,
  },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt2,
    padding: 24,
    paddingTop: Platform.OS === 'android' ? 24 + 60 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 50,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: colors.goldBackground,
    borderColor: colors.gold,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: colors.gold,
  },
  profilesList: {
    flex: 1,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  profileDescription: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  profileDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activateButton: {
    backgroundColor: colors.successAlt2,
  },
  editButton: {
    backgroundColor: colors.goldBackground,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  archiveButton: {
    backgroundColor: colors.warningAlt,
  },
  deleteButton: {
    backgroundColor: colors.errorAlt,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  createButton: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.shadowAlt3,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputHalf: {
    width: '48%', // Ao invés de inputThird
  },
  inputThird: {
    flex: 1,
    marginRight: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  hardwareTypeRow: {
    marginTop: 12,
    marginBottom: 8,
  },
  hardwareTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  hardwareTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  hardwareTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  hardwareTypeButtonActive: {
    backgroundColor: colors.goldBackground,
    borderColor: colors.gold,
  },
  hardwareTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hardwareTypeButtonTextActive: {
    color: colors.gold,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
});
