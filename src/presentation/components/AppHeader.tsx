// AppHeader.tsx - Componente reutilizável para cabeçalho das telas
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign, MaterialCommunityIcons } from '@/utils/vector-icons-helper';
import { colors } from '@presentation/theme';
import { useNavigation } from '@/contexts/NavigationContext';

interface Props {
  onBack?: () => void;
  onGoHome?: () => void;
  onOpenHistory?: () => void;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showHistoryButton?: boolean;
  backButtonText?: string;
}

export const AppHeader: React.FC<Props> = ({
  onBack,
  onGoHome,
  onOpenHistory,
  showBackButton = true,
  showHomeButton = true,
  showHistoryButton = true,
  backButtonText = 'Voltar',
}) => {
  // Usar contexto se props não forem fornecidas (elimina prop drilling)
  let navigation: ReturnType<typeof useNavigation> | null = null;
  try {
    navigation = useNavigation();
  } catch {
    // Contexto não disponível, usar props
  }

  const handleBack = onBack || navigation?.navigateBack;
  const handleGoHome = onGoHome || navigation?.goHome;
  const handleOpenHistory = onOpenHistory || navigation?.openHistory;
  return (
    <View style={styles.header}>
      {/* Botão Voltar */}
      {showBackButton && handleBack && (
        <TouchableOpacity onPress={handleBack} style={styles.backPill}>
          <AntDesign name="left" size={16} color={colors.gold} />
          <Text style={styles.backText}>{backButtonText}</Text>
        </TouchableOpacity>
      )}

      {/* Espaçador para centralizar quando não há botão voltar */}
      {!showBackButton && <View style={styles.spacer} />}

      {/* Botões da direita */}
      <View style={styles.headerRight}>
        {showHistoryButton && handleOpenHistory && (
          <TouchableOpacity onPress={handleOpenHistory} style={styles.iconBtn}>
            <MaterialCommunityIcons
              name="history"
              size={18}
              color={colors.gold}
            />
          </TouchableOpacity>
        )}
        {showHomeButton && handleGoHome && (
          <TouchableOpacity onPress={handleGoHome} style={styles.iconBtn}>
            <AntDesign name="home" size={18} color={colors.gold} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    marginTop: 50,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.goldBackground,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  backText: {
    color: colors.gold,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.goldBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppHeader;
